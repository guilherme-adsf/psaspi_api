import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class Collection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  status: string;

  @Column({
    nullable: true,
  })
  status_collect_replies: string;

  @Column({
    nullable: true,
  })
  status_collect_retweets_with_comment: string;

  @Column({ type: "date" })
  referenceDate: Date;

  @Column()
  totalTweets: number;

  @Column()
  profileId: string;

  @Column({
    nullable: true,
  })
  pathPdf: string;

  @Column({
    nullable: true,
  })
  pathHtml: string;

  @Column({
    nullable: true,
  })
  pathDocx: string;

  @Column({
    nullable: true,
  })
  followers: string;

  @Column({
    nullable: true,
    default: false,
  })
  wasViewed: boolean;
}
