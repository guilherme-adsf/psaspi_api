import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({
  name: "ibm_tokens",
})
export class IBMToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  version: string;

  @Column({
    nullable: true,
  })
  apiKey: string;

  @Column({
    nullable: true,
  })
  serviceUrl: string;

  @Column({
    nullable: true,
  })
  status: string;

  @Column({
    nullable: true,
  })
  label: string;

  @Column({
    nullable: true,
  })
  email: string;
}
