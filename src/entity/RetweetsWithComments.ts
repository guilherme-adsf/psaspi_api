import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({
  name: "retweets_with_comments",
})
export class RetweetsWithComments {
  @PrimaryGeneratedColumn()
  id: number;

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
  value: number;

  @Column({
    nullable: true,
  })
  gspSequence: string;

  @Column({
    nullable: true,
  })
  tweetId: string;
}
