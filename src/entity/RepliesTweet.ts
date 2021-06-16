import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({
  name: "replies_tweets",
})
export class RepliesTweets {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  timeStamp: string;

  @Column({
    nullable: true,
  })
  collectionId: number;

  @Column({
    nullable: true,
  })
  profileId: string;

  @Column({
    nullable: true,
  })
  replyStatusId: string;

  @Column({
    nullable: true,
  })
  replyText: string;

  @Column({
    nullable: true,
  })
  sentiment: string;

  @Column({
    nullable: true,
  })
  apiKey: string;
}
