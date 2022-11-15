import {assertNotNull} from '@subsquid/util-internal'
import assert from 'assert'
import {MikroORM, IsolationLevel, t} from '@mikro-orm/core'
import {Store} from './store'
import {createTransaction, Tx} from './tx'
import {PostgreSqlDriver, SqlEntityManager} from '@mikro-orm/postgresql'
import {createOrmConfig} from './config'

export interface TypeormDatabaseOptions {
    stateSchema?: string
    isolationLevel?: IsolationLevel
}

class BaseDatabase<S> {
    protected statusSchema: string
    protected isolationLevel: IsolationLevel
    protected orm?: MikroORM<PostgreSqlDriver>
    protected lastCommitted = -1

    constructor(options?: TypeormDatabaseOptions) {
        this.statusSchema = options?.stateSchema ? `"${options.stateSchema}"` : 'squid_processor'
        this.isolationLevel = options?.isolationLevel || IsolationLevel.SERIALIZABLE
    }

    async connect(): Promise<number> {
        if (this.orm != null) {
            throw new Error('Already connected')
        }
        let cfg = createOrmConfig()
        let orm = await MikroORM.init<PostgreSqlDriver>(cfg)
        try {
            let height = await orm.em.transactional(
                async (em) => {
                    await em.execute(`CREATE SCHEMA IF NOT EXISTS ${this.statusSchema}`)
                    await em.execute(`
                    CREATE TABLE IF NOT EXISTS ${this.statusSchema}.status (
                        id int primary key,
                        height int not null
                    )
                `)
                    let status: {height: number}[] = await em.execute(
                        `SELECT height FROM ${this.statusSchema}.status WHERE id = 0`
                    )
                    if (status.length == 0) {
                        await em.execute(`INSERT INTO ${this.statusSchema}.status (id, height) VALUES (0, -1)`)
                        return -1
                    } else {
                        return status[0].height
                    }
                },
                {
                    isolationLevel: IsolationLevel.SERIALIZABLE,
                }
            )
            this.orm = orm
            return height
        } catch (e: any) {
            await orm.close().catch(() => {}) // ignore error
            throw e
        }
    }

    async close(): Promise<void> {
        let orm = this.orm
        this.orm = undefined
        this.lastCommitted = -1
        if (orm) {
            await orm.close()
        }
    }

    async transact(from: number, to: number, cb: (store: S) => Promise<void>): Promise<void> {
        let retries = 3
        while (true) {
            try {
                return await this.runTransaction(from, to, cb)
            } catch (e: any) {
                if (e.code == '40001' && retries) {
                    retries -= 1
                } else {
                    throw e
                }
            }
        }
    }

    protected async runTransaction(from: number, to: number, cb: (store: S) => Promise<void>): Promise<void> {
        throw new Error('Not implemented')
    }

    protected async updateHeight(em: SqlEntityManager, from: number, to: number): Promise<void> {
        await em.execute(`UPDATE ${this.statusSchema}.status SET height = ${to} WHERE id = 0 AND height < ${from}`)
        // .then((result: [data: any[], rowsChanged: number]) => {
        //     let rowsChanged = result[1]
        //     assert.strictEqual(
        //         rowsChanged,
        //         1,
        //         'status table was updated by foreign process, make sure no other processor is running'
        //     )
        // })
    }
}

/**
 * Provides restrictive and lazy version of TypeORM EntityManager
 * to data handlers.
 *
 * Lazy here means that no database transaction is opened until an
 * actual database operation is requested by some data handler,
 * which allows more efficient data filtering within handlers.
 *
 * `TypeormDatabase` supports only primitive DML operations
 * without cascades, relations and other ORM goodies in return
 * for performance and exciting new features yet to be implemented :).
 *
 * Instances of this class should be considered to be completely opaque.
 */
export class MikroormDatabase extends BaseDatabase<Store> {
    protected async runTransaction(from: number, to: number, cb: (store: Store) => Promise<void>): Promise<void> {
        let tx = await this.createTx(from, to)
        let open = true

        let store = new Store(() => {
            assert(open, `Transaction was already closed`)
            return tx.em
        })

        try {
            await cb(store)
            await store.flush()
            store.clear()
        } catch (e: any) {
            open = false
            await tx.rollback().catch((err) => null)
            throw e
        }

        open = false
        await tx.commit()
        this.lastCommitted = to
    }

    private async createTx(from: number, to: number): Promise<Tx> {
        let orm = assertNotNull(this.orm, 'not connected')
        let tx = await createTransaction(orm.em, this.isolationLevel)
        try {
            await this.updateHeight(tx.em, from, to)
            return tx
        } catch (e: any) {
            await tx.rollback().catch(() => {})
            throw e
        }
    }

    async advance(height: number): Promise<void> {
        if (this.lastCommitted == height) return
        let tx = await this.createTx(height, height)
        await tx.commit()
    }
}
