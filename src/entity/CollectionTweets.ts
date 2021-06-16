import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity({
  name: "collections_tweets",
})
export class CollectionTweets {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: true,
  })
  timeStamp: string;

  @Column()
  collectionId: number;

  @Column()
  profileId: string;

  @Column()
  tweetId: string;

  @Column({
    nullable: true,
  })
  sentiment: string;

  @Column({
    nullable: true,
  })
  likes: number;

  @Column({
    nullable: true,
  })
  retweets: number;

  @Column({
    nullable: true,
  })
  retweetsWithComments: number;

  @Column({
    nullable: true,
  })
  comments: number;

  @Column({
    nullable: true,
  })
  gspSequence: string;

  @Column({
    nullable: true,
  })
  K_positive: string;

  @Column({
    nullable: true,
  })
  K_neutral: string;

  @Column({
    nullable: true,
  })
  K_negative: string;

  @Column({
    nullable: true,
  })
  K_nonclass: string;
}
