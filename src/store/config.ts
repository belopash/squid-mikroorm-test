export interface OrmOptions {
    projectDir?: string
}

export const MIGRATIONS_DIR = 'db/migrations'

export function createOrmConfig(options?: OrmOptions): Options {
    let dir = path.resolve(options?.projectDir || process.cwd())
    let model = path.join(dir, 'lib/model/models.js')
    let migrationsDir = path.join(dir, MIGRATIONS_DIR)
    return {
        type: 'postgresql',
        namingStrategy: UnderscoreNamingStrategy,
        entities: [model],
        migrations: {path: migrationsDir},
        // debug: ['query'],
        ...createConnectionOptions(),
        batchSize: 1000,
        useBatchInserts: true,
        useBatchUpdates: true,
    }
}

// function resolveModel(model: string): string {
//     model = path.resolve(model || 'lib/model')
//     try {
//         return require.resolve(model)
//     } catch (e: any) {
//         throw new Error(`Failed to resolve model ${model}. Did you forget to run codegen or compile the code?`)
//     }
// }

import process from 'process'

export interface ConnectionOptions {
    host: string
    port: number
    dbName: string
    user: string
    password: string
}

export function createConnectionOptions(): ConnectionOptions {
    return {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
        dbName: process.env.DB_NAME || 'postgres',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'postgres',
    }
}

import {UnderscoreNamingStrategy} from '@mikro-orm/core'
import path from 'path'
import {Options} from '@mikro-orm/postgresql'
import {createLogger, Logger} from '@subsquid/logger'
