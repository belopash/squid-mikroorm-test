import {
    Entity as Entity_,
    Property as Column_,
    PrimaryKey as PrimaryColumn_,
    OneToMany as OneToMany_,
    Index as Index_,
    ManyToOne as ManyToOne_,
} from '@mikro-orm/core'
import {Account} from './account.model'

@Entity_()
export class Transfer {
    constructor(props?: Partial<Transfer>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @Column_({nullable: false, type: 'int4'})
    blockNumber!: number

    @Index_()
    @Column_({nullable: false, type: 'timestamp with time zone'})
    timestamp!: Date

    @Index_()
    @Column_({nullable: true, type: 'string'})
    extrinsicHash!: string | undefined | null

    @Index_()
    @ManyToOne_(() => Account, {nullable: true, mapToPk: true})
    from!: string

    @Index_()
    @ManyToOne_(() => Account, {nullable: true, mapToPk: true})
    to!: string

    @Index_()
    @Column_({nullable: false, type: 'numeric'})
    amount!: bigint

    @Column_({nullable: false, type: 'numeric'})
    fee!: bigint
}
