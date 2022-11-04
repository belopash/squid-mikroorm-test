import {Entity as Entity_, Property as Column_, PrimaryKey as PrimaryColumn_, OneToMany as OneToMany_} from "@mikro-orm/core"

@Entity_()
export class Account {
  constructor(props?: Partial<Account>) {
    Object.assign(this, props)
  }

  /**
   * Account address
   */
  @PrimaryColumn_()
  id!: string
}
