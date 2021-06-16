import { getRepository } from "typeorm";
import { NextFunction, Request, Response } from "express";
import { User } from "../entity/User";
import { obj_response } from "../helpers/messages";
import { HTML_RECOVERY_PASSWORD } from "../consts";
import NodeMailer from "../services/NodeMailer";
import { Collection } from "../entity/Collection";
import { CollectionTweets } from "../entity/CollectionTweets";
import { RepliesTweets } from "../entity/RepliesTweet";
import { IBMToken } from "../entity/IBMToken";
import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import * as hbs from "handlebars";
import * as htmlpdf from "html-pdf-node";
import * as NaturalLanguageUnderstandingV1 from "ibm-watson/natural-language-understanding/v1";
import { IamAuthenticator } from "ibm-watson/auth";
import {
  calculation_mobilization_capacity,
  calculation_indication_mobilization_capacity,
} from "../helpers/calculations";
import { createObjectCsvWriter } from "csv-writer";
import { format_number_pt_br } from "../helpers/format_number";
import { IMaxValues, IMaxValuesResponse } from "../interfaces";

interface IBodyIteractionValue {
  countInteraction?: number;
  countWithActiveUsersInteractions?: number;
  countWithoutActiveUsersInteractions?: number;
  inativeUsers?: number;
  activeUsers?: number;
  divisionBetweenInteractions?: number;
  divisionBetweenUsersValues?: number;
}

interface IResponseIteractionsValues {
  vCSB?: IBodyIteractionValue;
  vCSBPositive?: IBodyIteractionValue;
  vCSBNeutral?: IBodyIteractionValue;
  vCSBNegative?: IBodyIteractionValue;
  vCSBNclass?: IBodyIteractionValue;
  followers?: number;
}

export class UserController {
  private userRepository = getRepository(User);
  private collectionRepository = getRepository(Collection);
  private collectionTweetsRepository = getRepository(CollectionTweets);
  private repliesTweetRepository = getRepository(RepliesTweets);
  private ibmRepository = getRepository(IBMToken);

  async save(request: Request, response: Response, next: NextFunction) {
    let user_exists = await this.userRepository.findOne({
      where: {
        email: request.body.email,
      },
    });

    if (user_exists) {
      return obj_response({
        status_code: 400,
        status: "error",
        message: "Já existe uma conta com este e-mail cadastrado.",
      });
    }

    const user = await this.userRepository.save(request.body);
    return obj_response({ status_code: 200, data: user });
  }

  async login(request: Request, response: Response, next: NextFunction) {
    const { email, password } = request.body;
    let user = await this.userRepository.findOne({
      where: {
        email,
      },
    });

    if (!user) {
      return obj_response({
        status_code: 400,
        status: "error",
        message: "Verifique seus dados.",
      });
    }

    if (password !== user.password) {
      return obj_response({
        status_code: 400,
        status: "error",
        message: "Verifique seus dados.",
      });
    }

    return obj_response({ status_code: 200, data: user });
  }

  async update(request: Request, response: Response, next: NextFunction) {
    const obj_keys = Object.keys(request.body);

    let user = await this.userRepository.findOne({
      where: {
        id: request.body.id,
      },
    });

    if (!user) {
      return obj_response({
        status_code: 400,
        status: "error",
        message: "E-mail não encontrado.",
      });
    }

    obj_keys.map((key) => {
      user[key] = request.body[key];
    });

    this.userRepository.save(user);

    return obj_response({ status_code: 200, data: user });
  }

  async send_email_recovery_password(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    let user = await this.userRepository.findOne({
      where: {
        email: request.params.email,
      },
    });

    if (!user) {
      return obj_response({
        status: "error",
        status_code: 500,
        message: "E-mail não encontrado.",
      });
    }

    const mailOptions = {
      from: "'Capital Social App' guilherme.adsferreira@gmail.com", // sender address
      to: user.email, // list of receivers
      subject: "Recuperação de senha", // Subject line
      html: HTML_RECOVERY_PASSWORD(user.id), // plain text body
    };

    const result = await NodeMailer.send_email(mailOptions);

    if (!result) {
      return obj_response({
        status: "error",
        status_code: 500,
        message: "E-mail não enviado.",
      });
    }

    return obj_response({
      status: "error",
      status_code: 200,
      message: "E-mail enviado.",
    });
  }

  async resetpassword(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      let user = await this.userRepository.findOne({
        where: {
          id: request.body.id,
        },
      });

      user.password = request.body.password;

      this.userRepository.save(user);

      return obj_response({
        status_code: 200,
        message: "Senha resetada com sucesso.",
      });
    } catch (err) {
      console.log(err);
      return obj_response({
        status: "error",
        status_code: 400,
        message: "Houve um erro de comunicação, tente novamente mais tarde.",
      });
    }
  }

  async getcollects(request: Request, response: Response, next: NextFunction) {
    try {
      const page = Number(request.query.page);
      const skip = page !== 1 ? (page - 1) * 100 : 0;

      const [result, total] = await this.collectionRepository.findAndCount({
        where: {
          userId: request.params.id,
          wasViewed: Number(request.query.wasViewed),
        },
        skip,
        take: 100,
      });

      result.sort((a, b) => b.id - a.id);

      return obj_response({
        status_code: 200,
        count: total,
        nextRequest: `/gettweetsofcollect/${request.params.id}/?page=${
          page + 1
        }`,
        data: result,
      });
    } catch (err) {
      return obj_response({
        status: "error",
        status_code: 500,
        message: "Houve um erro de comunicação, tente novamente mais tarde.",
      });
    }
  }

  async gettweetsofcollect(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      const page = Number(request.query.page);
      const skip = page !== 1 ? (page - 1) * 100 : 0;

      let [result, total] = await this.collectionTweetsRepository.findAndCount({
        where: {
          collectionId: request.params.id,
        },
        skip,
        take: 100,
      });

      return obj_response({
        status_code: 200,
        count: total,
        nextRequest: `/gettweetsofcollect/${request.params.id}/?page=${
          page + 1
        }`,
        data: result,
      });
    } catch (err) {
      return obj_response({
        status: "error",
        status_code: 500,
        message: "Houve um erro de comunicação, tente novamente mais tarde.",
      });
    }
  }

  async exportcsv(request: Request, response: Response, next: NextFunction) {
    try {
      let user = await this.userRepository.findOne({
        where: {
          id: request.body.user_id,
        },
      });

      const collects = await this.collectionTweetsRepository.find({
        where: {
          collectionId: request.body.collect_id,
        },
      });

      this.send_email_with_csv({ collects, email: user.email });

      return obj_response({
        status_code: 200,
        message:
          "Seu CSV está sendo exportado, em breve você receberá ele em seu e-mail.",
        data: collects,
      });
    } catch (err) {
      console.log(err);
      return obj_response({
        status: "error",
        status_code: 500,
        message: "Houve um erro de comunicação, tente novamente mais tarde.",
      });
    }
  }

  async viewcollection(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      let collect = await this.collectionRepository.findOne({
        where: {
          id: request.params.id,
        },
      });

      collect.wasViewed = true;

      this.collectionRepository.save(collect);

      return obj_response({
        status_code: 200,
        message: "Coleta visualizada.",
      });
    } catch (err) {
      console.log(err);
      return obj_response({
        status: "error",
        status_code: 500,
        message: "Houve um erro de comunicação, tente novamente mais tarde.",
      });
    }
  }

  async deletecollection(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      await this.collectionRepository.delete({
        id: Number(request.params.id),
      });

      await this.collectionTweetsRepository.delete({
        collectionId: Number(request.params.id),
      });

      await this.repliesTweetRepository.delete({
        collectionId: Number(request.params.id),
      });

      return obj_response({
        status_code: 200,
        message: "Coleta deletada.",
      });
    } catch (err) {
      console.log(err);
      return obj_response({
        status: "error",
        status_code: 500,
        message: "Houve um erro de comunicação, tente novamente mais tarde.",
      });
    }
  }

  async exportreport(request: Request, response: Response, next: NextFunction) {
    try {
      let user = await this.userRepository.findOne({
        where: {
          id: request.body.user_id,
        },
      });

      const collect = await this.collectionRepository.findOne({
        where: {
          id: request.body.collect_id,
        },
      });

      if (request.body.choice === "DOCX") {
        this.send_email_with_report({
          array_with_file_paths: [
            {
              path: collect.pathDocx,
            },
          ],
          email: user.email,
        });
      }

      if (request.body.choice === "PDF") {
        this.send_email_with_report({
          array_with_file_paths: [
            {
              path: collect.pathPdf,
            },
          ],
          email: user.email,
        });
      }

      return obj_response({
        status_code: 200,
        message:
          "Seu Relatório está sendo exportado, em breve você receberá ele em seu e-mail.",
      });
    } catch (err) {
      console.log(err);
      return obj_response({
        status: "error",
        status_code: 500,
        message: "Houve um erro de comunicação, tente novamente mais tarde.",
      });
    }
  }

  async exportallreports(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      let user = await this.userRepository.findOne({
        where: {
          id: request.body.user_id,
        },
      });

      const collect = await this.collectionRepository.findOne({
        where: {
          id: request.body.collect_id,
        },
      });

      const collects = await this.collectionTweetsRepository.find({
        where: {
          collectionId: request.body.collect_id,
        },
      });

      const csv_path = path.resolve(
        __dirname,
        "..",
        "..",
        "storage",
        `${uuidv4()}.csv`
      );

      const csvWriter = createObjectCsvWriter({
        path: csv_path,
        header: [
          { id: "id", title: "id" },
          { id: "profileId", title: "profileId" },
          { id: "tweetId", title: "tweetId" },
          { id: "timeStamp", title: "timeStamp" },
          { id: "sentiment", title: "sentiment" },
          { id: "likes", title: "L" },
          { id: "retweets", title: "Rt" },
          { id: "retweetsWithComments", title: "RtK" },
          { id: "comments", title: "K" },
          { id: "gspSequence", title: "gspSequence" },
          { id: "K_positive", title: "K_positive" },
          { id: "K_neutral", title: "K_neutral" },
          { id: "K_negative", title: "K_negative" },
          { id: "K_nonclass", title: "K_nonclass" },
        ],
      });

      csvWriter.writeRecords(collects).then(async () => {
        this.send_email_with_report({
          array_with_file_paths: [
            {
              path: collect.pathDocx,
            },
            {
              path: collect.pathPdf,
            },
            {
              path: csv_path,
            },
          ],
          email: user.email,
        });
      });

      return obj_response({
        status_code: 200,
        message:
          "Seus Relatórios estão sendo exportado, em breve você receberá eles em seu e-mail.",
      });
    } catch (err) {
      console.log(err);
      return obj_response({
        status: "error",
        status_code: 500,
        message: "Houve um erro de comunicação, tente novamente mais tarde.",
      });
    }
  }

  async send_email_with_report({ array_with_file_paths, email }) {
    try {
      const mailOptions = {
        from: "'PSASPI - Relatório Solicitado' guilherme.adsferreira@gmail.com", // sender address
        to: email, // list of receivers
        subject: "Relatório", // Subject line
        attachments: array_with_file_paths,
      };

      await NodeMailer.send_email(mailOptions);
    } catch (err) {
      console.log(err);
    }
  }

  async send_email_with_csv({ collects, email }) {
    try {
      const csv_path = path.resolve(
        __dirname,
        "..",
        "..",
        "storage",
        `${uuidv4()}.csv`
      );

      const csvWriter = createObjectCsvWriter({
        path: csv_path,
        header: [
          { id: "id", title: "id" },
          { id: "profileId", title: "profileId" },
          { id: "tweetId", title: "tweetId" },
          { id: "timeStamp", title: "timeStamp" },
          { id: "sentiment", title: "sentiment" },
          { id: "likes", title: "L" },
          { id: "retweets", title: "Rt" },
          { id: "retweetsWithComments", title: "RtK" },
          { id: "comments", title: "K" },
          { id: "gspSequence", title: "gspSequence" },
          { id: "K_positive", title: "K_positive" },
          { id: "K_neutral", title: "K_neutral" },
          { id: "K_negative", title: "K_negative" },
          { id: "K_nonclass", title: "K_nonclass" },
        ],
      });

      csvWriter.writeRecords(collects).then(async () => {
        const mailOptions = {
          from: "'PSASPI - CSV Solicitado' guilherme.adsferreira@gmail.com", // sender address
          to: email, // list of receivers
          subject: "CSV", // Subject line
          attachments: [
            {
              path: csv_path,
            },
          ],
        };

        await NodeMailer.send_email(mailOptions);
      });
    } catch (err) {
      console.log(err);
    }
  }

  async get_sentiment_collect_report({ collect_id, sentiment }) {
    const tweets = await this.collectionTweetsRepository.findAndCount({
      where: {
        collectionId: collect_id,
        sentiment,
      },
    });

    const freq = tweets[1];
    const data = tweets[0];

    const sum_likes = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select("SUM(collection.likes)", "sum")
      .where(
        "collection.collectionId = :id AND collection.sentiment = :sentiment",
        { id: collect_id, sentiment }
      )
      .getRawOne();

    const sum_retweets = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select("SUM(collection.retweets)", "sum")
      .where(
        "collection.collectionId = :id AND collection.sentiment = :sentiment",
        { id: collect_id, sentiment }
      )
      .getRawOne();

    const sum_retweets_with_comments = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select("SUM(collection.retweetsWithComments)", "sum")
      .where(
        "collection.collectionId = :id AND collection.sentiment = :sentiment",
        { id: collect_id, sentiment }
      )
      .getRawOne();

    const sum_comments = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select("SUM(collection.comments)", "sum")
      .where(
        "collection.collectionId = :id AND collection.sentiment = :sentiment",
        { id: collect_id, sentiment }
      )
      .getRawOne();

    let average_likes;
    let average_retweets;
    let average_retweets_with_comments;
    let average_comments;

    try {
      if (!sum_likes.sum) throw Error("Null");
      average_likes = sum_likes.sum / freq;
      average_likes = average_likes;
    } catch (err) {
      average_likes = 0;
    }

    // console.log("Media de Likes: ", sum_likes.sum, freq, average_likes);

    // console.log(
    //   `Tabela 1 - [${sentiment}] - Média de Likes (Soma de Likes em Sentimentos ${sentiment} [${sum_likes.sum}] / Frequencia do Sentimento [${freq}]) = ${average_likes}`
    // );

    try {
      if (!sum_retweets.sum) throw Error("Null");
      average_retweets = sum_retweets.sum / freq;
      average_retweets = average_retweets;
    } catch (err) {
      average_retweets = 0;
    }

    // console.log(
    //   "Media de Retweets: ",
    //   sum_retweets.sum,
    //   freq,
    //   average_retweets
    // );

    // console.log(
    //   `Tabela 1 - [${sentiment}] - Média de Rt (Soma de Rt em Sentimentos ${sentiment} [${sum_retweets.sum}] / Frequencia do Sentimento [${freq}]) = ${average_retweets}`
    // );

    try {
      if (!sum_retweets_with_comments.sum) throw Error("Null");
      average_retweets_with_comments = sum_retweets_with_comments.sum / freq;
      average_retweets_with_comments = average_retweets_with_comments;
    } catch (err) {
      average_retweets_with_comments = 0;
    }

    // console.log(
    //   "Media de Retweets: ",
    //   sum_retweets_with_comments.sum,
    //   freq,
    //   average_retweets_with_comments
    // );

    // console.log(
    //   `Tabela 1 - [${sentiment}] - Média de RtK (Soma de RtK em Sentimentos ${sentiment} [${sum_retweets_with_comments.sum}] / Frequencia do Sentimento [${freq}]) = ${average_retweets_with_comments}`
    // );

    try {
      if (!sum_comments.sum) throw Error("Null");
      average_comments = sum_comments.sum / freq;
      average_comments = average_comments;
    } catch (err) {
      average_comments = 0;
    }

    // console.log(
    //   "Media de Retweets: ",
    //   sum_comments.sum,
    //   freq,
    //   average_comments
    // );

    const result = {
      freq,
      sum_likes: sum_likes && sum_likes.sum ? Number(sum_likes.sum) : 0,
      sum_retweets:
        sum_retweets && sum_retweets.sum ? Number(sum_retweets.sum) : 0,
      sum_retweets_with_comments:
        sum_retweets_with_comments && sum_retweets_with_comments.sum
          ? Number(sum_retweets_with_comments.sum)
          : 0,
      sum_comments:
        sum_comments && sum_comments.sum ? Number(sum_comments.sum) : Number(0),
      average_likes: average_likes ? Number(average_likes) : 0,
      average_retweets: average_retweets ? Number(average_retweets) : 0,
      average_retweets_with_comments: average_retweets_with_comments
        ? Number(average_retweets_with_comments)
        : 0,
      average_comments: average_comments ? Number(average_comments) : 0,
      averageOfAverage: 0,
      mobEfetive: 0,
    };

    const sum_average =
      result.average_likes +
      result.average_retweets +
      result.average_retweets_with_comments +
      result.average_comments;

    try {
      const averageResult = sum_average / 4;
      result.averageOfAverage = averageResult;
      result.mobEfetive = freq * averageResult;
    } catch (err) {
      result.averageOfAverage = 0;
      result.mobEfetive = 0;
    }

    // console.log("Soma das Médias: ", sum_average);
    // console.log("Media das Medias: ", sum_average, 4, result.averageOfAverage);
    console.log(
      "Mob Efetive: ",
      result.freq,
      result.averageOfAverage,
      result.mobEfetive
    );

    // console.log(
    //   `Tabela 1 - [${sentiment}] - Média de K (Soma de K em Sentimentos ${sentiment} [${sum_comments.sum}] / Frequencia do Sentimento [${freq}]) = ${average_comments}`
    // );
    // console.log(`Tabela 1 - [${sentiment}] - Soma de L - ${result.sum_likes}`);
    // console.log(
    //   `Tabela 1 - [${sentiment}] - Soma de Rt - ${result.sum_retweets}`
    // );
    // console.log(
    //   `Tabela 1 - [${sentiment}] - Soma de Rtk - ${result.sum_retweets_with_comments}`
    // );
    // console.log(
    //   `Tabela 1 - [${sentiment}] - Soma de K - ${result.sum_comments}`
    // );
    // console.log(
    //   `Tabela 1 - [${sentiment}] - Media de L - ${result.average_likes}`
    // );
    // console.log(
    //   `Tabela 1 - [${sentiment}] - Média de Rt - ${result.average_retweets}`
    // );
    // console.log(
    //   `Tabela 1 - [${sentiment}] - Média de Rt - ${result.average_retweets_with_comments}`
    // );
    // console.log(
    //   `Tabela 1 - [${sentiment}] - Média de K - ${result.average_comments}`
    // );

    // console.log("\n");

    return result;
  }

  async get_gsp_collect_report({ collect_id, gspSequence }) {
    const tweets = await this.collectionTweetsRepository.findAndCount({
      where: {
        collectionId: collect_id,
        gspSequence,
      },
    });

    const freq = tweets[1];

    const sum_likes = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select("SUM(collection.likes)", "sum")
      .where(
        "collection.collectionId = :id AND collection.gspSequence = :gspSequence",
        { id: collect_id, gspSequence }
      )
      .getRawOne();

    const sum_retweets = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select("SUM(collection.retweets)", "sum")
      .where(
        "collection.collectionId = :id AND collection.gspSequence = :gspSequence",
        { id: collect_id, gspSequence }
      )
      .getRawOne();

    const sum_retweets_with_comments = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select("SUM(collection.retweetsWithComments)", "sum")
      .where(
        "collection.collectionId = :id AND collection.gspSequence = :gspSequence",
        { id: collect_id, gspSequence }
      )
      .getRawOne();

    const sum_comments = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select("SUM(collection.comments)", "sum")
      .where(
        "collection.collectionId = :id AND collection.gspSequence = :gspSequence",
        { id: collect_id, gspSequence }
      )
      .getRawOne();

    let average_likes;
    let average_retweets;
    let average_retweets_with_comments;
    let average_comments;

    // console.log(
    //   `Tabela 2 - [Coluna: Frequência] - [Linha: ${gspSequence}] - ${freq}`
    // );

    try {
      if (!sum_likes.sum) throw Error("Null");
      // console.log(`${sum_likes.sum} / ${freq}`);
      average_likes = sum_likes.sum / freq;
      average_likes = average_likes;
    } catch (err) {
      average_likes = 0;
    }

    // console.log(
    //   `Tabela 2 - [Coluna: Média de L] - [Linha: ${gspSequence}] - ${average_likes}`
    // );

    try {
      if (!sum_retweets.sum) throw Error("Null");
      // console.log(`${sum_retweets.sum} / ${freq}`);
      average_retweets = sum_retweets.sum / freq;
      average_retweets = average_retweets;
    } catch (err) {
      average_retweets = 0;
    }

    // console.log(
    //   `Tabela 2 - [Coluna: Média de Rt] - [Linha: ${gspSequence}] - ${average_retweets}`
    // );

    try {
      if (!sum_retweets_with_comments.sum) throw Error("Null");
      // console.log(`${sum_retweets_with_comments.sum} / ${freq}`);
      average_retweets_with_comments = sum_retweets_with_comments.sum / freq;
      average_retweets_with_comments = average_retweets_with_comments;
    } catch (err) {
      average_retweets_with_comments = 0;
    }

    // console.log(
    //   `Tabela 2 - [Coluna: Média de Rtk] - [Linha: ${gspSequence}] - ${average_retweets_with_comments}`
    // );

    try {
      if (!sum_comments.sum) throw Error("Null");
      // console.log(`${sum_comments.sum} / ${freq}`);
      average_comments = sum_comments.sum / freq;
      average_comments = average_comments;
    } catch (err) {
      average_comments = 0;
    }

    // console.log(
    //   `Tabela 2 - [Coluna: Média de K] - [Linha: ${gspSequence}] - ${average_comments}`
    // );

    const res = {
      freq,
      sum_likes: sum_likes && sum_likes.sum ? sum_likes.sum : 0,
      sum_retweets:
        sum_retweets && sum_retweets.sum ? Number(sum_retweets.sum) : 0,
      sum_retweets_with_comments:
        sum_retweets_with_comments && sum_retweets_with_comments.sum
          ? Number(sum_retweets_with_comments.sum)
          : 0,
      sum_comments:
        sum_comments && sum_comments.sum ? Number(sum_comments.sum) : 0,
      average_likes: average_likes ? Number(average_likes) : 0,
      average_retweets: average_retweets ? Number(average_retweets) : 0,
      average_retweets_with_comments: average_retweets_with_comments
        ? Number(average_retweets_with_comments)
        : 0,
      average_comments: average_comments ? Number(average_comments) : 0,
      // capability_of_mobilization: calculation_mobilization_capacity({
      //   averageLikes: average_likes ? Number(average_likes) : 0,
      //   averageRetweets: average_retweets ? Number(average_retweets) : 0,
      //   averageRetweetsWithComments: average_retweets_with_comments
      //     ? Number(average_retweets_with_comments)
      //     : 0,
      //   averageComments: average_comments ? Number(average_comments) : 0,
      //   freq,
      // }),
      // indicator_capability_of_mobilization:
      //   calculation_indication_mobilization_capacity({
      //     sequence: gspSequence,
      //     averageLikes: average_likes ? Number(average_likes) : 0,
      //     averageRetweets: average_retweets ? Number(average_retweets) : 0,
      //     averageRetweetsWithComments: average_retweets_with_comments
      //       ? Number(average_retweets_with_comments)
      //       : 0,
      //     averageComments: average_comments ? Number(average_comments) : 0,
      //   }),
      gspSequence,
      averageOfAverage: 0,
      mobEfetive: 0,
    };

    try {
      const sum_average =
        res.average_likes +
        res.average_retweets +
        res.average_retweets_with_comments +
        res.average_comments;
      const averageResult = sum_average / 4;
      res.averageOfAverage = averageResult;
      res.mobEfetive = res.freq * averageResult;
      console.log(averageResult, res.freq, res.mobEfetive);
    } catch (err) {
      res.averageOfAverage = 0;
      res.mobEfetive = 0;

      console.log(0, 0);
    }

    return res;
  }

  async get_max_value_of_column({
    collect_id,
    sentiment = undefined,
    column = undefined,
    gspSequence = undefined,
  }: IMaxValues) {
    let where_condition = "collection.collectionId = :id";
    let params_condition: any = { id: collect_id };

    if (sentiment) {
      where_condition =
        where_condition + " AND collection.sentiment = :sentiment";
      params_condition.sentiment = sentiment;
    }

    if (gspSequence) {
      where_condition =
        where_condition + " AND collection.gspSequence = :gspSequence";
      params_condition.gspSequence = gspSequence;
    }

    if (column) {
      const result = await this.collectionTweetsRepository
        .createQueryBuilder("collection")
        .select(`MAX(collection.${column})`, "max")
        .where(where_condition, params_condition)
        .getRawOne();

      return result.max ? result.max : 0;
    }

    // console.log(where_condition);
    // console.log(params_condition);

    const max_value_likes = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select(`MAX(collection.likes)`, "max")
      .where(where_condition, params_condition)
      .getRawOne();

    const max_value_retweets = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select(`MAX(collection.retweets)`, "max")
      .where(where_condition, params_condition)
      .getRawOne();

    const max_value_retweets_with_comments =
      await this.collectionTweetsRepository
        .createQueryBuilder("collection")
        .select(`MAX(collection.retweetsWithComments)`, "max")
        .where(where_condition, params_condition)
        .getRawOne();

    const max_value_comments = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select(`MAX(collection.comments)`, "max")
      .where(where_condition, params_condition)
      .getRawOne();

    return {
      maxLikes: max_value_likes.max ? max_value_likes.max : 0,
      maxRetweets: max_value_retweets.max ? max_value_retweets.max : 0,
      maxRetweetsWithComments: max_value_retweets_with_comments.max
        ? max_value_retweets_with_comments.max
        : 0,
      maxComments: max_value_comments.max ? max_value_comments.max : 0,
    };
  }

  async get_number_of_interactions({
    collect_id,
  }): Promise<IResponseIteractionsValues> {
    console.time("Inicio");

    const res: IResponseIteractionsValues = await Promise.all([
      this.collectionRepository.findOne({
        id: collect_id,
      }),
      this.collectionTweetsRepository.findAndCount({
        collectionId: collect_id,
      }),
      // this.collectionTweetsRepository.findAndCount({
      //   collectionId: collect_id,
      //   gspSequence: "!L !Rt !RtK !K",
      // }),
      this.collectionTweetsRepository.findAndCount({
        collectionId: collect_id,
        sentiment: "positive",
      }),
      // this.collectionTweetsRepository.findAndCount({
      //   collectionId: collect_id,
      //   gspSequence: "!L !Rt !RtK !K",
      //   sentiment: "positive",
      // }),
      this.collectionTweetsRepository.findAndCount({
        collectionId: collect_id,
        sentiment: "neutral",
      }),
      // this.collectionTweetsRepository.findAndCount({
      //   collectionId: collect_id,
      //   gspSequence: "!L !Rt !RtK !K",
      //   sentiment: "neutral",
      // }),
      this.collectionTweetsRepository.findAndCount({
        collectionId: collect_id,
        sentiment: "negative",
      }),
      // this.collectionTweetsRepository.findAndCount({
      //   collectionId: collect_id,
      //   gspSequence: "!L !Rt !RtK !K",
      //   sentiment: "negative",
      // }),
      this.collectionTweetsRepository.findAndCount({
        collectionId: collect_id,
        sentiment: "não classificado",
      }),
      // this.collectionTweetsRepository.findAndCount({
      //   collectionId: collect_id,
      //   gspSequence: "!L !Rt !RtK !K",
      //   sentiment: "não classificado",
      // }),
      // this.get_max_value_of_column({ collect_id, column: "likes" }),
      // this.get_max_value_of_column({
      //   collect_id,
      //   sentiment: "positive",
      //   column: "likes",
      // }),
      // this.get_max_value_of_column({
      //   collect_id,
      //   sentiment: "neutral",
      //   column: "likes",
      // }),
      // this.get_max_value_of_column({
      //   collect_id,
      //   sentiment: "negative",
      //   column: "likes",
      // }),
      // this.get_max_value_of_column({
      //   collect_id,
      //   sentiment: "não classificado",
      //   column: "likes",
      // }),
    ])
      .then(
        ([
          collect,
          number_of_interactions,
          // number_of_interactions_without_active_user,
          number_of_interactions_positive,
          // number_of_interactions_positive_without_active_user,
          number_of_interactions_neutral,
          // number_of_interactions_neutral_without_active_user,
          number_of_interactions_negative,
          // number_of_interactions_negative_without_active_user,
          number_of_interactions_nclass,
          // number_of_interactions_nclass_without_active_user,
          // max_number_of_likes,
          // max_number_of_likes_positive,
          // max_number_of_likes_neutral,
          // max_number_of_likes_negative,
          // max_number_of_likes_nclass,
        ]) => {
          const followers = Number(collect.followers.replace(/\.|,/g, ""));

          const count_of_interactions = number_of_interactions[1] || 1;
          // const count_of_interactions_without_active_user =
          //   number_of_interactions_without_active_user[1];
          // const inativeUsers = followers - max_number_of_likes;
          // const countInteractionActiveUsers =
          //   count_of_interactions - count_of_interactions_without_active_user;
          // const divisionBetweenInteractions =
          //   countInteractionActiveUsers /
          //   (count_of_interactions_without_active_user || 1);
          // const divisionBetweenUsersValues =
          //   max_number_of_likes / (inativeUsers || 1);

          const vCSB: IBodyIteractionValue = {
            countInteraction: count_of_interactions,
            // countWithActiveUsersInteractions: countInteractionActiveUsers,
            // countWithoutActiveUsersInteractions:
            //   count_of_interactions_without_active_user,
            // inativeUsers,
            // activeUsers: max_number_of_likes,
            // divisionBetweenInteractions: divisionBetweenInteractions || 1,
            // divisionBetweenUsersValues: divisionBetweenUsersValues || 1,
          };

          const count_of_positive_interactions =
            number_of_interactions_positive[1] || 1;
          // const count_of_positive_interactions_without_active_user =
          //   number_of_interactions_positive_without_active_user[1];
          // const inativePositiveUsers = followers - max_number_of_likes_positive;
          // const positiveCountInteractionActiveUsers =
          //   count_of_positive_interactions -
          //   count_of_positive_interactions_without_active_user;
          // const positiveDivisionBetweenInteractions =
          //   positiveCountInteractionActiveUsers /
          //   (count_of_positive_interactions_without_active_user || 1);
          // const positiveDivisionBetweenUsersValues =
          //   max_number_of_likes_positive / (inativePositiveUsers || 1);

          const vCSBPositive: IBodyIteractionValue = {
            countInteraction: count_of_positive_interactions,
            // countWithActiveUsersInteractions:
            //   positiveCountInteractionActiveUsers,
            // countWithoutActiveUsersInteractions:
            //   count_of_positive_interactions_without_active_user,
            // inativeUsers: inativePositiveUsers,
            // activeUsers: max_number_of_likes_positive,
            // divisionBetweenInteractions:
            //   positiveDivisionBetweenInteractions || 1,
            // divisionBetweenUsersValues: positiveDivisionBetweenUsersValues || 1,
          };

          const count_of_neutral_interactions =
            number_of_interactions_neutral[1] || 1;
          // const count_of_neutral_interactions_without_active_user =
          //   number_of_interactions_neutral_without_active_user[1];
          // const inativeNeutralUsers = followers - max_number_of_likes_neutral;
          // const neutralCountInteractionActiveUsers =
          //   count_of_neutral_interactions -
          //   count_of_neutral_interactions_without_active_user;
          // const neutralDivisionBetweenInteractions =
          //   neutralCountInteractionActiveUsers /
          //   (count_of_neutral_interactions_without_active_user || 1);
          // const neutralDivisionBetweenUsersValues =
          //   max_number_of_likes_neutral / (inativeNeutralUsers || 1);

          const vCSBNeutral: IBodyIteractionValue = {
            countInteraction: count_of_neutral_interactions,
            // countWithActiveUsersInteractions:
            //   neutralCountInteractionActiveUsers,
            // countWithoutActiveUsersInteractions:
            //   count_of_neutral_interactions_without_active_user,
            // inativeUsers: inativeNeutralUsers,
            // activeUsers: max_number_of_likes_neutral,
            // divisionBetweenInteractions:
            //   neutralDivisionBetweenInteractions || 1,
            // divisionBetweenUsersValues: neutralDivisionBetweenUsersValues || 1,
          };

          const count_of_negative_interactions =
            number_of_interactions_negative[1] || 1;
          // const count_of_negative_interactions_without_active_user =
          //   number_of_interactions_negative_without_active_user[1];
          // const negativeCountInteractionActiveUsers =
          //   count_of_negative_interactions -
          //   count_of_negative_interactions_without_active_user;
          // const inativeNegativeUsers = followers - max_number_of_likes_negative;
          // const negativeDivisionBetweenInteractions =
          //   negativeCountInteractionActiveUsers /
          //   (count_of_negative_interactions_without_active_user || 1);
          // const negativeDivisionBetweenUsersValues =
          //   max_number_of_likes_negative / (inativeNegativeUsers || 1);

          const vCSBNegative: IBodyIteractionValue = {
            countInteraction: count_of_negative_interactions,
            // countWithActiveUsersInteractions:
            //   negativeCountInteractionActiveUsers,
            // countWithoutActiveUsersInteractions:
            //   count_of_negative_interactions_without_active_user || 1,
            // inativeUsers: inativeNegativeUsers,
            // activeUsers: max_number_of_likes_negative,
            // divisionBetweenInteractions:
            //   negativeDivisionBetweenInteractions || 1,
            // divisionBetweenUsersValues: negativeDivisionBetweenUsersValues || 1,
          };

          const count_of_nclass_interactions =
            number_of_interactions_nclass[1] || 1;
          // const count_of_nclass_interactions_without_active_user =
          //   number_of_interactions_nclass_without_active_user[1];
          // const inativeNclassUsers = followers - max_number_of_likes_nclass;
          // const nclassCountInteractionActiveUsers =
          //   count_of_nclass_interactions -
          //   count_of_nclass_interactions_without_active_user;
          // const nclassDivisionBetweenInteractions =
          //   nclassCountInteractionActiveUsers /
          //   (count_of_nclass_interactions_without_active_user || 1);
          // const nclassDivisionBetweenUsersValues =
          //   max_number_of_likes_nclass / (inativeNclassUsers || 1);

          const vCSBNclass: IBodyIteractionValue = {
            countInteraction: count_of_nclass_interactions,
            // countWithActiveUsersInteractions: nclassCountInteractionActiveUsers,
            // countWithoutActiveUsersInteractions:
            //   count_of_nclass_interactions_without_active_user || 1,
            // inativeUsers: inativeNclassUsers,
            // activeUsers: max_number_of_likes_nclass,
            // divisionBetweenInteractions: nclassDivisionBetweenInteractions || 1,
            // divisionBetweenUsersValues: nclassDivisionBetweenUsersValues || 1,
          };

          const response: IResponseIteractionsValues = {
            vCSB,
            vCSBPositive,
            vCSBNeutral,
            vCSBNegative,
            vCSBNclass,
            followers,
          };

          return response;
        }
      )
      .catch((erro) => {
        const response: IResponseIteractionsValues = {};

        return response;
      });

    return res;
  }

  async get_max_values({ collect_id }): Promise<IMaxValuesResponse> {
    const res: IMaxValuesResponse = await Promise.all([
      this.get_max_value_of_column({ collect_id, sentiment: "positive" }),
      this.get_max_value_of_column({ collect_id, sentiment: "neutral" }),
      this.get_max_value_of_column({ collect_id, sentiment: "negative" }),
      this.get_max_value_of_column({
        collect_id,
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt !Rtk !K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt !Rtk K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt Rtk !K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt !Rtk !K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt !Rtk !K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt Rtk K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt !Rtk K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt !Rtk K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt Rtk !K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt Rtk !K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt !Rtk !K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt Rtk !K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt Rtk K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt !Rtk K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt Rtk K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt Rtk K",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt !Rtk !K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt !Rtk K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt Rtk !K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt !Rtk !K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt !Rtk !K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt Rtk K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt !Rtk K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt !Rtk K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt Rtk !K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt Rtk !K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt !Rtk !K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt Rtk !K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt Rtk K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt !Rtk K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt Rtk K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt Rtk K",
        sentiment: "positive",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt !Rtk !K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt !Rtk K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt Rtk !K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt !Rtk !K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt !Rtk !K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt Rtk K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt !Rtk K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt !Rtk K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt Rtk !K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt Rtk !K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt !Rtk !K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt Rtk !K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt Rtk K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt !Rtk K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt Rtk K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt Rtk K",
        sentiment: "neutral",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt !Rtk !K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt !Rtk K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt Rtk !K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt !Rtk !K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt !Rtk !K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt Rtk K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt !Rtk K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt !Rtk K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt Rtk !K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt Rtk !K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt !Rtk !K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt Rtk !K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt Rtk K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt !Rtk K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt Rtk K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt Rtk K",
        sentiment: "negative",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt !Rtk !K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt !Rtk K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt Rtk !K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt !Rtk !K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt !Rtk !K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L !Rt Rtk K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt !Rtk K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt !Rtk K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt Rtk !K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt Rtk !K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt !Rtk !K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt Rtk !K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "!L Rt Rtk K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt !Rtk K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L !Rt Rtk K",
        sentiment: "não classificado",
      }),
      this.get_max_value_of_column({
        collect_id,
        gspSequence: "L Rt Rtk K",
        sentiment: "não classificado",
      }),
    ])
      .then(
        ([
          max_value_positive,
          max_value_negative,
          max_value_neutral,
          max_value_nclass,
          NL_NRt_NRtk_NK_max_value,
          NL_NRt_NRtk_K_max_value,
          NL_NRt_Rtk_NK_max_value,
          NL_Rt_NRtk_NK_max_value,
          L_NRt_NRtk_NK_max_value,
          NL_NRt_Rtk_K_max_value,
          NL_Rt_NRtk_K_max_value,
          L_NRt_NRtk_K_max_value,
          NL_Rt_Rtk_NK_max_value,
          L_NRt_Rtk_NK_max_value,
          L_Rt_NRtk_NK_max_value,
          L_Rt_Rtk_NK_max_value,
          NL_Rt_Rtk_K_max_value,
          L_Rt_NRtk_K_max_value,
          L_NRt_Rtk_K_max_value,
          L_Rt_Rtk_K_max_value,
          NL_NRt_NRtk_NK_positive_max_value,
          NL_NRt_NRtk_K_positive_max_value,
          NL_NRt_Rtk_NK_positive_max_value,
          NL_Rt_NRtk_NK_positive_max_value,
          L_NRt_NRtk_NK_positive_max_value,
          NL_NRt_Rtk_K_positive_max_value,
          NL_Rt_NRtk_K_positive_max_value,
          L_NRt_NRtk_K_positive_max_value,
          NL_Rt_Rtk_NK_positive_max_value,
          L_NRt_Rtk_NK_positive_max_value,
          L_Rt_NRtk_NK_positive_max_value,
          L_Rt_Rtk_NK_positive_max_value,
          NL_Rt_Rtk_K_positive_max_value,
          L_Rt_NRtk_K_positive_max_value,
          L_NRt_Rtk_K_positive_max_value,
          L_Rt_Rtk_K_positive_max_value,
          NL_NRt_NRtk_NK_neutral_max_value,
          NL_NRt_NRtk_K_neutral_max_value,
          NL_NRt_Rtk_NK_neutral_max_value,
          NL_Rt_NRtk_NK_neutral_max_value,
          L_NRt_NRtk_NK_neutral_max_value,
          NL_NRt_Rtk_K_neutral_max_value,
          NL_Rt_NRtk_K_neutral_max_value,
          L_NRt_NRtk_K_neutral_max_value,
          NL_Rt_Rtk_NK_neutral_max_value,
          L_NRt_Rtk_NK_neutral_max_value,
          L_Rt_NRtk_NK_neutral_max_value,
          L_Rt_Rtk_NK_neutral_max_value,
          NL_Rt_Rtk_K_neutral_max_value,
          L_Rt_NRtk_K_neutral_max_value,
          L_NRt_Rtk_K_neutral_max_value,
          L_Rt_Rtk_K_neutral_max_value,
          NL_NRt_NRtk_NK_negative_max_value,
          NL_NRt_NRtk_K_negative_max_value,
          NL_NRt_Rtk_NK_negative_max_value,
          NL_Rt_NRtk_NK_negative_max_value,
          L_NRt_NRtk_NK_negative_max_value,
          NL_NRt_Rtk_K_negative_max_value,
          NL_Rt_NRtk_K_negative_max_value,
          L_NRt_NRtk_K_negative_max_value,
          NL_Rt_Rtk_NK_negative_max_value,
          L_NRt_Rtk_NK_negative_max_value,
          L_Rt_NRtk_NK_negative_max_value,
          L_Rt_Rtk_NK_negative_max_value,
          NL_Rt_Rtk_K_negative_max_value,
          L_Rt_NRtk_K_negative_max_value,
          L_NRt_Rtk_K_negative_max_value,
          L_Rt_Rtk_K_negative_max_value,
          NL_NRt_NRtk_NK_nclass_max_value,
          NL_NRt_NRtk_K_nclass_max_value,
          NL_NRt_Rtk_NK_nclass_max_value,
          NL_Rt_NRtk_NK_nclass_max_value,
          L_NRt_NRtk_NK_nclass_max_value,
          NL_NRt_Rtk_K_nclass_max_value,
          NL_Rt_NRtk_K_nclass_max_value,
          L_NRt_NRtk_K_nclass_max_value,
          NL_Rt_Rtk_NK_nclass_max_value,
          L_NRt_Rtk_NK_nclass_max_value,
          L_Rt_NRtk_NK_nclass_max_value,
          L_Rt_Rtk_NK_nclass_max_value,
          NL_Rt_Rtk_K_nclass_max_value,
          L_Rt_NRtk_K_nclass_max_value,
          L_NRt_Rtk_K_nclass_max_value,
          L_Rt_Rtk_K_nclass_max_value,
        ]) => {
          return {
            max_value_positive,
            max_value_negative,
            max_value_neutral,
            max_value_nclass,
            NL_NRt_NRtk_NK_max_value,
            NL_NRt_NRtk_K_max_value,
            NL_NRt_Rtk_NK_max_value,
            NL_Rt_NRtk_NK_max_value,
            L_NRt_NRtk_NK_max_value,
            NL_NRt_Rtk_K_max_value,
            NL_Rt_NRtk_K_max_value,
            L_NRt_NRtk_K_max_value,
            NL_Rt_Rtk_NK_max_value,
            L_NRt_Rtk_NK_max_value,
            L_Rt_NRtk_NK_max_value,
            L_Rt_Rtk_NK_max_value,
            NL_Rt_Rtk_K_max_value,
            L_Rt_NRtk_K_max_value,
            L_NRt_Rtk_K_max_value,
            L_Rt_Rtk_K_max_value,
            NL_NRt_NRtk_NK_positive_max_value,
            NL_NRt_NRtk_K_positive_max_value,
            NL_NRt_Rtk_NK_positive_max_value,
            NL_Rt_NRtk_NK_positive_max_value,
            L_NRt_NRtk_NK_positive_max_value,
            NL_NRt_Rtk_K_positive_max_value,
            NL_Rt_NRtk_K_positive_max_value,
            L_NRt_NRtk_K_positive_max_value,
            NL_Rt_Rtk_NK_positive_max_value,
            L_NRt_Rtk_NK_positive_max_value,
            L_Rt_NRtk_NK_positive_max_value,
            L_Rt_Rtk_NK_positive_max_value,
            NL_Rt_Rtk_K_positive_max_value,
            L_Rt_NRtk_K_positive_max_value,
            L_NRt_Rtk_K_positive_max_value,
            L_Rt_Rtk_K_positive_max_value,
            NL_NRt_NRtk_NK_neutral_max_value,
            NL_NRt_NRtk_K_neutral_max_value,
            NL_NRt_Rtk_NK_neutral_max_value,
            NL_Rt_NRtk_NK_neutral_max_value,
            L_NRt_NRtk_NK_neutral_max_value,
            NL_NRt_Rtk_K_neutral_max_value,
            NL_Rt_NRtk_K_neutral_max_value,
            L_NRt_NRtk_K_neutral_max_value,
            NL_Rt_Rtk_NK_neutral_max_value,
            L_NRt_Rtk_NK_neutral_max_value,
            L_Rt_NRtk_NK_neutral_max_value,
            L_Rt_Rtk_NK_neutral_max_value,
            NL_Rt_Rtk_K_neutral_max_value,
            L_Rt_NRtk_K_neutral_max_value,
            L_NRt_Rtk_K_neutral_max_value,
            L_Rt_Rtk_K_neutral_max_value,
            NL_NRt_NRtk_NK_negative_max_value,
            NL_NRt_NRtk_K_negative_max_value,
            NL_NRt_Rtk_NK_negative_max_value,
            NL_Rt_NRtk_NK_negative_max_value,
            L_NRt_NRtk_NK_negative_max_value,
            NL_NRt_Rtk_K_negative_max_value,
            NL_Rt_NRtk_K_negative_max_value,
            L_NRt_NRtk_K_negative_max_value,
            NL_Rt_Rtk_NK_negative_max_value,
            L_NRt_Rtk_NK_negative_max_value,
            L_Rt_NRtk_NK_negative_max_value,
            L_Rt_Rtk_NK_negative_max_value,
            NL_Rt_Rtk_K_negative_max_value,
            L_Rt_NRtk_K_negative_max_value,
            L_NRt_Rtk_K_negative_max_value,
            L_Rt_Rtk_K_negative_max_value,
            NL_NRt_NRtk_NK_nclass_max_value,
            NL_NRt_NRtk_K_nclass_max_value,
            NL_NRt_Rtk_NK_nclass_max_value,
            NL_Rt_NRtk_NK_nclass_max_value,
            L_NRt_NRtk_NK_nclass_max_value,
            NL_NRt_Rtk_K_nclass_max_value,
            NL_Rt_NRtk_K_nclass_max_value,
            L_NRt_NRtk_K_nclass_max_value,
            NL_Rt_Rtk_NK_nclass_max_value,
            L_NRt_Rtk_NK_nclass_max_value,
            L_Rt_NRtk_NK_nclass_max_value,
            L_Rt_Rtk_NK_nclass_max_value,
            NL_Rt_Rtk_K_nclass_max_value,
            L_Rt_NRtk_K_nclass_max_value,
            L_NRt_Rtk_K_nclass_max_value,
            L_Rt_Rtk_K_nclass_max_value,
          } as IMaxValuesResponse;
        }
      )
      .catch((error) => {
        return {} as IMaxValuesResponse;
      });

    return res;
  }

  async get_gsp_collect_with_sentiment_report({
    collect_id,
    gspSequence,
    sentiment,
  }) {
    const tweets = await this.collectionTweetsRepository.findAndCount({
      where: {
        collectionId: collect_id,
        gspSequence,
        sentiment,
      },
    });

    const freq = tweets[1];

    const sum_likes = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select("SUM(collection.likes)", "sum")
      .where(
        "collection.collectionId = :id AND collection.gspSequence = :gspSequence AND collection.sentiment = :sentiment",
        { id: collect_id, gspSequence, sentiment }
      )
      .getRawOne();

    const sum_retweets = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select("SUM(collection.retweets)", "sum")
      .where(
        "collection.collectionId = :id AND collection.gspSequence = :gspSequence AND collection.sentiment = :sentiment",
        { id: collect_id, gspSequence, sentiment }
      )
      .getRawOne();

    const sum_retweets_with_comments = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select("SUM(collection.retweetsWithComments)", "sum")
      .where(
        "collection.collectionId = :id AND collection.gspSequence = :gspSequence AND collection.sentiment = :sentiment",
        { id: collect_id, gspSequence, sentiment }
      )
      .getRawOne();

    const sum_comments = await this.collectionTweetsRepository
      .createQueryBuilder("collection")
      .select("SUM(collection.comments)", "sum")
      .where(
        "collection.collectionId = :id AND collection.gspSequence = :gspSequence AND collection.sentiment = :sentiment",
        { id: collect_id, gspSequence, sentiment }
      )
      .getRawOne();

    let average_likes;
    let average_retweets;
    let average_retweets_with_comments;
    let average_comments;

    try {
      if (!sum_likes.sum) throw Error("Null");
      average_likes = sum_likes.sum / freq;
      average_likes = average_likes;
    } catch (err) {
      average_likes = 0;
    }

    try {
      if (!sum_retweets.sum) throw Error("Null");
      average_retweets = sum_retweets.sum / freq;
      average_retweets = average_retweets;
    } catch (err) {
      average_retweets = 0;
    }

    try {
      if (!sum_retweets_with_comments.sum) throw Error("Null");
      average_retweets_with_comments = sum_retweets_with_comments.sum / freq;
      average_retweets_with_comments = average_retweets_with_comments;
    } catch (err) {
      average_retweets_with_comments = 0;
    }

    try {
      if (!sum_comments.sum) throw Error("Null");
      average_comments = sum_comments.sum / freq;
      average_comments = average_comments;
    } catch (err) {
      average_comments = 0;
    }

    // console.log("Tabela 4 - Positive");
    // console.log(
    //   `Tabela 4 - [Coluna: Frequência] - [Linha: ${gspSequence}] - ${freq}`
    // );
    // console.log(
    //   `${sum_likes.sum} Tabela 4 - [Coluna: Média de L] - [Linha: ${gspSequence}] - ${average_likes}`
    // );
    // console.log(
    //   `${sum_retweets.sum} Tabela 4 - [Coluna: Média de Rt] - [Linha: ${gspSequence}] - ${average_retweets}`
    // );
    // console.log(
    //   `${sum_retweets_with_comments.sum} Tabela 4 - [Coluna: Média de Rtk] - [Linha: ${gspSequence}] - ${average_retweets_with_comments}`
    // );
    // console.log(
    //   `${sum_comments.sum} Tabela 4 - [Coluna: Média de K] - [Linha: ${gspSequence}] - ${average_comments}`
    // );

    const result = {
      freq,
      sum_likes: sum_likes && sum_likes.sum ? sum_likes.sum : 0,
      sum_retweets:
        sum_retweets && sum_retweets.sum ? Number(sum_retweets.sum) : 0,
      sum_retweets_with_comments:
        sum_retweets_with_comments && sum_retweets_with_comments.sum
          ? Number(sum_retweets_with_comments.sum)
          : 0,
      sum_comments:
        sum_comments && sum_comments.sum ? Number(sum_comments.sum) : 0,
      average_likes: average_likes ? Number(average_likes) : 0,
      average_retweets: average_retweets ? Number(average_retweets) : 0,
      average_retweets_with_comments: average_retweets_with_comments
        ? Number(average_retweets_with_comments)
        : 0,
      average_comments: average_comments ? Number(average_comments) : 0,

      gspSequence,
      averageOfAverage: 0,
      mobEfetive: 0,
    };

    try {
      const sum_average =
        result.average_likes +
        result.average_retweets +
        result.average_retweets_with_comments +
        result.average_comments;
      const averageResult = sum_average / 4;
      result.averageOfAverage = averageResult;
      result.mobEfetive = result.freq * averageResult;
    } catch (err) {
      result.averageOfAverage = 0;
      result.mobEfetive = 0;
    }

    // console.log(result);

    return result;
  }

  async verify_ibm_token_status(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    const keys = await this.ibmRepository.find();

    const result = await Promise.all([
      ...keys.map(async (item) => {
        const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1(
          {
            version: item.version,
            authenticator: new IamAuthenticator({
              apikey: item.apiKey,
            }),
            serviceUrl: item.serviceUrl,
          }
        );

        return naturalLanguageUnderstanding
          .analyze({
            text: "Este sentimento poderia ser positivo",
            language: "pt",
            features: {
              sentiment: {
                document: true,
              },
            },
          })
          .then(async (analysisResults) => {
            console.log(analysisResults.result.sentiment.document.label);

            await this.ibmRepository.update(
              { id: item.id },
              {
                status: "Ativo",
              }
            );

            return { label: item.label, status: "Ativo" };
          })
          .catch(async (err) => {
            console.log("error:", err.status);

            await this.ibmRepository.update(
              { id: item.id },
              {
                status: "Inativo",
              }
            );

            return { label: item.label, status: "Inativo" };
          });
      }),
    ]);

    const exist_active_key = result.some((item) => item.status === "Ativo");
    const active_keys = result.filter((item) => item.status === "Ativo");

    return response.status(200).json({
      openModal: !exist_active_key,
      active_keys,
      message:
        "Nosso app dispoe de um plano gratuito que possui um limite mensal, nosso limite desse mês se esgotou enquanto nosso plano não volta estaremos desativando a coleta de tweets",
    });
  }

  async collection_report(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    try {
      let collect_id = request.params.id;

      response.status(200).json({ status: "ok" });

      const max_values = await this.get_max_values({ collect_id });

      const user_interactions_value_vcsb =
        await this.get_number_of_interactions({ collect_id });

      // Dados rotulados por sentimento
      const positive_report = await this.get_sentiment_collect_report({
        collect_id,
        sentiment: "positive",
      });

      const neutral_report = await this.get_sentiment_collect_report({
        collect_id,
        sentiment: "neutral",
      });

      const negative_report = await this.get_sentiment_collect_report({
        collect_id,
        sentiment: "negative",
      });

      const unclassified_report = await this.get_sentiment_collect_report({
        collect_id,
        sentiment: "não classificado",
      });

      // Dados rotulados pela sequência GSP
      const NL_NRt_NRtk_NK = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "!L !Rt !Rtk !K",
      });

      const NL_NRt_NRtk_K = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "!L !Rt !Rtk K",
      });

      const NL_NRt_Rtk_NK = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "!L !Rt Rtk !K",
      });

      const NL_Rt_NRtk_NK = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "!L Rt !Rtk !K",
      });

      const L_NRt_NRtk_NK = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "L !Rt !Rtk !K",
      });

      const NL_NRt_Rtk_K = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "!L !Rt Rtk K",
      });

      const NL_Rt_NRtk_K = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "!L Rt !Rtk K",
      });

      const L_NRt_NRtk_K = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "L !Rt !Rtk K",
      });

      const NL_Rt_Rtk_NK = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "!L Rt Rtk !K",
      });

      const L_NRt_Rtk_NK = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "L !Rt Rtk !K",
      });

      const L_Rt_NRtk_NK = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "L Rt !Rtk !K",
      });

      const L_Rt_Rtk_NK = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "L Rt Rtk !K",
      });

      const NL_Rt_Rtk_K = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "!L Rt Rtk K",
      });

      const L_Rt_NRtk_K = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "L Rt !Rtk K",
      });

      const L_NRt_Rtk_K = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "L !Rt Rtk K",
      });

      const L_Rt_Rtk_K = await this.get_gsp_collect_report({
        collect_id,
        gspSequence: "L Rt Rtk K",
      });

      const {
        max_value_positive,
        max_value_negative,
        max_value_neutral,
        max_value_nclass,
        NL_NRt_NRtk_NK_max_value,
        NL_NRt_NRtk_K_max_value,
        NL_NRt_Rtk_NK_max_value,
        NL_Rt_NRtk_NK_max_value,
        L_NRt_NRtk_NK_max_value,
        NL_NRt_Rtk_K_max_value,
        NL_Rt_NRtk_K_max_value,
        L_NRt_NRtk_K_max_value,
        NL_Rt_Rtk_NK_max_value,
        L_NRt_Rtk_NK_max_value,
        L_Rt_NRtk_NK_max_value,
        L_Rt_Rtk_NK_max_value,
        NL_Rt_Rtk_K_max_value,
        L_Rt_NRtk_K_max_value,
        L_NRt_Rtk_K_max_value,
        L_Rt_Rtk_K_max_value,
        NL_NRt_NRtk_NK_positive_max_value,
        NL_NRt_NRtk_K_positive_max_value,
        NL_NRt_Rtk_NK_positive_max_value,
        NL_Rt_NRtk_NK_positive_max_value,
        L_NRt_NRtk_NK_positive_max_value,
        NL_NRt_Rtk_K_positive_max_value,
        NL_Rt_NRtk_K_positive_max_value,
        L_NRt_NRtk_K_positive_max_value,
        NL_Rt_Rtk_NK_positive_max_value,
        L_NRt_Rtk_NK_positive_max_value,
        L_Rt_NRtk_NK_positive_max_value,
        L_Rt_Rtk_NK_positive_max_value,
        NL_Rt_Rtk_K_positive_max_value,
        L_Rt_NRtk_K_positive_max_value,
        L_NRt_Rtk_K_positive_max_value,
        L_Rt_Rtk_K_positive_max_value,
        NL_NRt_NRtk_NK_neutral_max_value,
        NL_NRt_NRtk_K_neutral_max_value,
        NL_NRt_Rtk_NK_neutral_max_value,
        NL_Rt_NRtk_NK_neutral_max_value,
        L_NRt_NRtk_NK_neutral_max_value,
        NL_NRt_Rtk_K_neutral_max_value,
        NL_Rt_NRtk_K_neutral_max_value,
        L_NRt_NRtk_K_neutral_max_value,
        NL_Rt_Rtk_NK_neutral_max_value,
        L_NRt_Rtk_NK_neutral_max_value,
        L_Rt_NRtk_NK_neutral_max_value,
        L_Rt_Rtk_NK_neutral_max_value,
        NL_Rt_Rtk_K_neutral_max_value,
        L_Rt_NRtk_K_neutral_max_value,
        L_NRt_Rtk_K_neutral_max_value,
        L_Rt_Rtk_K_neutral_max_value,
        NL_NRt_NRtk_NK_negative_max_value,
        NL_NRt_NRtk_K_negative_max_value,
        NL_NRt_Rtk_NK_negative_max_value,
        NL_Rt_NRtk_NK_negative_max_value,
        L_NRt_NRtk_NK_negative_max_value,
        NL_NRt_Rtk_K_negative_max_value,
        NL_Rt_NRtk_K_negative_max_value,
        L_NRt_NRtk_K_negative_max_value,
        NL_Rt_Rtk_NK_negative_max_value,
        L_NRt_Rtk_NK_negative_max_value,
        L_Rt_NRtk_NK_negative_max_value,
        L_Rt_Rtk_NK_negative_max_value,
        NL_Rt_Rtk_K_negative_max_value,
        L_Rt_NRtk_K_negative_max_value,
        L_NRt_Rtk_K_negative_max_value,
        L_Rt_Rtk_K_negative_max_value,
        NL_NRt_NRtk_NK_nclass_max_value,
        NL_NRt_NRtk_K_nclass_max_value,
        NL_NRt_Rtk_NK_nclass_max_value,
        NL_Rt_NRtk_NK_nclass_max_value,
        L_NRt_NRtk_NK_nclass_max_value,
        NL_NRt_Rtk_K_nclass_max_value,
        NL_Rt_NRtk_K_nclass_max_value,
        L_NRt_NRtk_K_nclass_max_value,
        NL_Rt_Rtk_NK_nclass_max_value,
        L_NRt_Rtk_NK_nclass_max_value,
        L_Rt_NRtk_NK_nclass_max_value,
        L_Rt_Rtk_NK_nclass_max_value,
        NL_Rt_Rtk_K_nclass_max_value,
        L_Rt_NRtk_K_nclass_max_value,
        L_NRt_Rtk_K_nclass_max_value,
        L_Rt_Rtk_K_nclass_max_value,
      } = max_values;

      const sum_reports = {
        sumMaxLikes:
          max_value_positive.maxLikes +
          max_value_neutral.maxLikes +
          max_value_negative.maxLikes +
          max_value_nclass.maxLikes,
        sumMaxRetweets:
          max_value_positive.maxRetweets +
          max_value_neutral.maxRetweets +
          max_value_negative.maxRetweets +
          max_value_nclass.maxRetweets,
        sumMaxRetweetsWithComments:
          max_value_positive.maxRetweetsWithComments +
          max_value_neutral.maxRetweetsWithComments +
          max_value_negative.maxRetweetsWithComments +
          max_value_nclass.maxRetweetsWithComments,
        sumMaxComments:
          max_value_positive.maxComments +
          max_value_neutral.maxComments +
          max_value_negative.maxComments +
          max_value_nclass.maxComments,
        sumAverageOfAverage: format_number_pt_br(
          positive_report.averageOfAverage +
            neutral_report.averageOfAverage +
            negative_report.averageOfAverage +
            unclassified_report.averageOfAverage
        ),
        sumMobEfetive: format_number_pt_br(
          positive_report.mobEfetive +
            neutral_report.mobEfetive +
            negative_report.mobEfetive +
            unclassified_report.mobEfetive
        ),
        sumGspMaxLikes: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_max_value.maxLikes +
            NL_NRt_NRtk_K_max_value.maxLikes +
            NL_NRt_Rtk_NK_max_value.maxLikes +
            NL_Rt_NRtk_NK_max_value.maxLikes +
            L_NRt_NRtk_NK_max_value.maxLikes +
            NL_NRt_Rtk_K_max_value.maxLikes +
            NL_Rt_NRtk_K_max_value.maxLikes +
            L_NRt_NRtk_K_max_value.maxLikes +
            NL_Rt_Rtk_NK_max_value.maxLikes +
            L_NRt_Rtk_NK_max_value.maxLikes +
            L_Rt_NRtk_NK_max_value.maxLikes +
            L_Rt_Rtk_NK_max_value.maxLikes +
            NL_Rt_Rtk_K_max_value.maxLikes +
            L_Rt_NRtk_K_max_value.maxLikes +
            L_NRt_Rtk_K_max_value.maxLikes +
            L_Rt_Rtk_K_max_value.maxLikes
          ).toFixed(2)
        ),
        byGspHighestLikeValue: Math.max(
          NL_NRt_NRtk_NK_max_value.maxLikes,
          NL_NRt_NRtk_K_max_value.maxLikes,
          NL_NRt_Rtk_NK_max_value.maxLikes,
          NL_Rt_NRtk_NK_max_value.maxLikes,
          L_NRt_NRtk_NK_max_value.maxLikes,
          NL_NRt_Rtk_K_max_value.maxLikes,
          NL_Rt_NRtk_K_max_value.maxLikes,
          L_NRt_NRtk_K_max_value.maxLikes,
          NL_Rt_Rtk_NK_max_value.maxLikes,
          L_NRt_Rtk_NK_max_value.maxLikes,
          L_Rt_NRtk_NK_max_value.maxLikes,
          L_Rt_Rtk_NK_max_value.maxLikes,
          NL_Rt_Rtk_K_max_value.maxLikes,
          L_Rt_NRtk_K_max_value.maxLikes,
          L_NRt_Rtk_K_max_value.maxLikes,
          L_Rt_Rtk_K_max_value.maxLikes
        ),
        sumGspMaxRetweets: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_max_value.maxRetweets +
            NL_NRt_NRtk_K_max_value.maxRetweets +
            NL_NRt_Rtk_NK_max_value.maxRetweets +
            NL_Rt_NRtk_NK_max_value.maxRetweets +
            L_NRt_NRtk_NK_max_value.maxRetweets +
            NL_NRt_Rtk_K_max_value.maxRetweets +
            NL_Rt_NRtk_K_max_value.maxRetweets +
            L_NRt_NRtk_K_max_value.maxRetweets +
            NL_Rt_Rtk_NK_max_value.maxRetweets +
            L_NRt_Rtk_NK_max_value.maxRetweets +
            L_Rt_NRtk_NK_max_value.maxRetweets +
            L_Rt_Rtk_NK_max_value.maxRetweets +
            NL_Rt_Rtk_K_max_value.maxRetweets +
            L_Rt_NRtk_K_max_value.maxRetweets +
            L_NRt_Rtk_K_max_value.maxRetweets +
            L_Rt_Rtk_K_max_value.maxRetweets
          ).toFixed(2)
        ),
        byGspHighestRetweetValue: Math.max(
          NL_NRt_NRtk_NK_max_value.maxRetweets,
          NL_NRt_NRtk_K_max_value.maxRetweets,
          NL_NRt_Rtk_NK_max_value.maxRetweets,
          NL_Rt_NRtk_NK_max_value.maxRetweets,
          L_NRt_NRtk_NK_max_value.maxRetweets,
          NL_NRt_Rtk_K_max_value.maxRetweets,
          NL_Rt_NRtk_K_max_value.maxRetweets,
          L_NRt_NRtk_K_max_value.maxRetweets,
          NL_Rt_Rtk_NK_max_value.maxRetweets,
          L_NRt_Rtk_NK_max_value.maxRetweets,
          L_Rt_NRtk_NK_max_value.maxRetweets,
          L_Rt_Rtk_NK_max_value.maxRetweets,
          NL_Rt_Rtk_K_max_value.maxRetweets,
          L_Rt_NRtk_K_max_value.maxRetweets,
          L_NRt_Rtk_K_max_value.maxRetweets,
          L_Rt_Rtk_K_max_value.maxRetweets
        ),
        sumGspMaxRetweetsWithComments: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_max_value.maxRetweetsWithComments +
            NL_NRt_NRtk_K_max_value.maxRetweetsWithComments +
            NL_NRt_Rtk_NK_max_value.maxRetweetsWithComments +
            NL_Rt_NRtk_NK_max_value.maxRetweetsWithComments +
            L_NRt_NRtk_NK_max_value.maxRetweetsWithComments +
            NL_NRt_Rtk_K_max_value.maxRetweetsWithComments +
            NL_Rt_NRtk_K_max_value.maxRetweetsWithComments +
            L_NRt_NRtk_K_max_value.maxRetweetsWithComments +
            NL_Rt_Rtk_NK_max_value.maxRetweetsWithComments +
            L_NRt_Rtk_NK_max_value.maxRetweetsWithComments +
            L_Rt_NRtk_NK_max_value.maxRetweetsWithComments +
            L_Rt_Rtk_NK_max_value.maxRetweetsWithComments +
            NL_Rt_Rtk_K_max_value.maxRetweetsWithComments +
            L_Rt_NRtk_K_max_value.maxRetweetsWithComments +
            L_NRt_Rtk_K_max_value.maxRetweetsWithComments +
            L_Rt_Rtk_K_max_value.maxRetweetsWithComments
          ).toFixed(2)
        ),
        byGspHighestRetweetWithCommentValue: Math.max(
          NL_NRt_NRtk_NK_max_value.maxRetweetsWithComments,
          NL_NRt_NRtk_K_max_value.maxRetweetsWithComments,
          NL_NRt_Rtk_NK_max_value.maxRetweetsWithComments,
          NL_Rt_NRtk_NK_max_value.maxRetweetsWithComments,
          L_NRt_NRtk_NK_max_value.maxRetweetsWithComments,
          NL_NRt_Rtk_K_max_value.maxRetweetsWithComments,
          NL_Rt_NRtk_K_max_value.maxRetweetsWithComments,
          L_NRt_NRtk_K_max_value.maxRetweetsWithComments,
          NL_Rt_Rtk_NK_max_value.maxRetweetsWithComments,
          L_NRt_Rtk_NK_max_value.maxRetweetsWithComments,
          L_Rt_NRtk_NK_max_value.maxRetweetsWithComments,
          L_Rt_Rtk_NK_max_value.maxRetweetsWithComments,
          NL_Rt_Rtk_K_max_value.maxRetweetsWithComments,
          L_Rt_NRtk_K_max_value.maxRetweetsWithComments,
          L_NRt_Rtk_K_max_value.maxRetweetsWithComments,
          L_Rt_Rtk_K_max_value.maxRetweetsWithComments
        ),
        sumGspMaxComments: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_max_value.maxComments +
            NL_NRt_NRtk_K_max_value.maxComments +
            NL_NRt_Rtk_NK_max_value.maxComments +
            NL_Rt_NRtk_NK_max_value.maxComments +
            L_NRt_NRtk_NK_max_value.maxComments +
            NL_NRt_Rtk_K_max_value.maxComments +
            NL_Rt_NRtk_K_max_value.maxComments +
            L_NRt_NRtk_K_max_value.maxComments +
            NL_Rt_Rtk_NK_max_value.maxComments +
            L_NRt_Rtk_NK_max_value.maxComments +
            L_Rt_NRtk_NK_max_value.maxComments +
            L_Rt_Rtk_NK_max_value.maxComments +
            NL_Rt_Rtk_K_max_value.maxComments +
            L_Rt_NRtk_K_max_value.maxComments +
            L_NRt_Rtk_K_max_value.maxComments +
            L_Rt_Rtk_K_max_value.maxComments
          ).toFixed(2)
        ),
        byGspHighestCommentValue: Math.max(
          NL_NRt_NRtk_NK_max_value.maxComments,
          NL_NRt_NRtk_K_max_value.maxComments,
          NL_NRt_Rtk_NK_max_value.maxComments,
          NL_Rt_NRtk_NK_max_value.maxComments,
          L_NRt_NRtk_NK_max_value.maxComments,
          NL_NRt_Rtk_K_max_value.maxComments,
          NL_Rt_NRtk_K_max_value.maxComments,
          L_NRt_NRtk_K_max_value.maxComments,
          NL_Rt_Rtk_NK_max_value.maxComments,
          L_NRt_Rtk_NK_max_value.maxComments,
          L_Rt_NRtk_NK_max_value.maxComments,
          L_Rt_Rtk_NK_max_value.maxComments,
          NL_Rt_Rtk_K_max_value.maxComments,
          L_Rt_NRtk_K_max_value.maxComments,
          L_NRt_Rtk_K_max_value.maxComments,
          L_Rt_Rtk_K_max_value.maxComments
        ),
        sumPositiveMaxLikes: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_positive_max_value.maxLikes +
            NL_NRt_NRtk_K_positive_max_value.maxLikes +
            NL_NRt_Rtk_NK_positive_max_value.maxLikes +
            NL_Rt_NRtk_NK_positive_max_value.maxLikes +
            L_NRt_NRtk_NK_positive_max_value.maxLikes +
            NL_NRt_Rtk_K_positive_max_value.maxLikes +
            NL_Rt_NRtk_K_positive_max_value.maxLikes +
            L_NRt_NRtk_K_positive_max_value.maxLikes +
            NL_Rt_Rtk_NK_positive_max_value.maxLikes +
            L_NRt_Rtk_NK_positive_max_value.maxLikes +
            L_Rt_NRtk_NK_positive_max_value.maxLikes +
            L_Rt_Rtk_NK_positive_max_value.maxLikes +
            NL_Rt_Rtk_K_positive_max_value.maxLikes +
            L_Rt_NRtk_K_positive_max_value.maxLikes +
            L_NRt_Rtk_K_positive_max_value.maxLikes +
            L_Rt_Rtk_K_positive_max_value.maxLikes
          ).toFixed(2)
        ),
        byGspPositiveHighestLikeValue: Math.max(
          NL_NRt_NRtk_NK_positive_max_value.maxLikes,
          NL_NRt_NRtk_K_positive_max_value.maxLikes,
          NL_NRt_Rtk_NK_positive_max_value.maxLikes,
          NL_Rt_NRtk_NK_positive_max_value.maxLikes,
          L_NRt_NRtk_NK_positive_max_value.maxLikes,
          NL_NRt_Rtk_K_positive_max_value.maxLikes,
          NL_Rt_NRtk_K_positive_max_value.maxLikes,
          L_NRt_NRtk_K_positive_max_value.maxLikes,
          NL_Rt_Rtk_NK_positive_max_value.maxLikes,
          L_NRt_Rtk_NK_positive_max_value.maxLikes,
          L_Rt_NRtk_NK_positive_max_value.maxLikes,
          L_Rt_Rtk_NK_positive_max_value.maxLikes,
          NL_Rt_Rtk_K_positive_max_value.maxLikes,
          L_Rt_NRtk_K_positive_max_value.maxLikes,
          L_NRt_Rtk_K_positive_max_value.maxLikes,
          L_Rt_Rtk_K_positive_max_value.maxLikes
        ),
        sumPositiveMaxRetweets: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_positive_max_value.maxRetweets +
            NL_NRt_NRtk_K_positive_max_value.maxRetweets +
            NL_NRt_Rtk_NK_positive_max_value.maxRetweets +
            NL_Rt_NRtk_NK_positive_max_value.maxRetweets +
            L_NRt_NRtk_NK_positive_max_value.maxRetweets +
            NL_NRt_Rtk_K_positive_max_value.maxRetweets +
            NL_Rt_NRtk_K_positive_max_value.maxRetweets +
            L_NRt_NRtk_K_positive_max_value.maxRetweets +
            NL_Rt_Rtk_NK_positive_max_value.maxRetweets +
            L_NRt_Rtk_NK_positive_max_value.maxRetweets +
            L_Rt_NRtk_NK_positive_max_value.maxRetweets +
            L_Rt_Rtk_NK_positive_max_value.maxRetweets +
            NL_Rt_Rtk_K_positive_max_value.maxRetweets +
            L_Rt_NRtk_K_positive_max_value.maxRetweets +
            L_NRt_Rtk_K_positive_max_value.maxRetweets +
            L_Rt_Rtk_K_positive_max_value.maxRetweets
          ).toFixed(2)
        ),
        byGspPositiveRetweetHighestValue: Math.max(
          NL_NRt_NRtk_NK_positive_max_value.maxRetweets,
          NL_NRt_NRtk_K_positive_max_value.maxRetweets,
          NL_NRt_Rtk_NK_positive_max_value.maxRetweets,
          NL_Rt_NRtk_NK_positive_max_value.maxRetweets,
          L_NRt_NRtk_NK_positive_max_value.maxRetweets,
          NL_NRt_Rtk_K_positive_max_value.maxRetweets,
          NL_Rt_NRtk_K_positive_max_value.maxRetweets,
          L_NRt_NRtk_K_positive_max_value.maxRetweets,
          NL_Rt_Rtk_NK_positive_max_value.maxRetweets,
          L_NRt_Rtk_NK_positive_max_value.maxRetweets,
          L_Rt_NRtk_NK_positive_max_value.maxRetweets,
          L_Rt_Rtk_NK_positive_max_value.maxRetweets,
          NL_Rt_Rtk_K_positive_max_value.maxRetweets,
          L_Rt_NRtk_K_positive_max_value.maxRetweets,
          L_NRt_Rtk_K_positive_max_value.maxRetweets,
          L_Rt_Rtk_K_positive_max_value.maxRetweets
        ),
        sumPositiveMaxRetweetsWithComments: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_positive_max_value.maxRetweetsWithComments +
            NL_NRt_NRtk_K_positive_max_value.maxRetweetsWithComments +
            NL_NRt_Rtk_NK_positive_max_value.maxRetweetsWithComments +
            NL_Rt_NRtk_NK_positive_max_value.maxRetweetsWithComments +
            L_NRt_NRtk_NK_positive_max_value.maxRetweetsWithComments +
            NL_NRt_Rtk_K_positive_max_value.maxRetweetsWithComments +
            NL_Rt_NRtk_K_positive_max_value.maxRetweetsWithComments +
            L_NRt_NRtk_K_positive_max_value.maxRetweetsWithComments +
            NL_Rt_Rtk_NK_positive_max_value.maxRetweetsWithComments +
            L_NRt_Rtk_NK_positive_max_value.maxRetweetsWithComments +
            L_Rt_NRtk_NK_positive_max_value.maxRetweetsWithComments +
            L_Rt_Rtk_NK_positive_max_value.maxRetweetsWithComments +
            NL_Rt_Rtk_K_positive_max_value.maxRetweetsWithComments +
            L_Rt_NRtk_K_positive_max_value.maxRetweetsWithComments +
            L_NRt_Rtk_K_positive_max_value.maxRetweetsWithComments +
            L_Rt_Rtk_K_positive_max_value.maxRetweetsWithComments
          ).toFixed(2)
        ),
        byGspPositiveRetweetWithCommentHighestValue: Math.max(
          NL_NRt_NRtk_NK_positive_max_value.maxRetweetsWithComments,
          NL_NRt_NRtk_K_positive_max_value.maxRetweetsWithComments,
          NL_NRt_Rtk_NK_positive_max_value.maxRetweetsWithComments,
          NL_Rt_NRtk_NK_positive_max_value.maxRetweetsWithComments,
          L_NRt_NRtk_NK_positive_max_value.maxRetweetsWithComments,
          NL_NRt_Rtk_K_positive_max_value.maxRetweetsWithComments,
          NL_Rt_NRtk_K_positive_max_value.maxRetweetsWithComments,
          L_NRt_NRtk_K_positive_max_value.maxRetweetsWithComments,
          NL_Rt_Rtk_NK_positive_max_value.maxRetweetsWithComments,
          L_NRt_Rtk_NK_positive_max_value.maxRetweetsWithComments,
          L_Rt_NRtk_NK_positive_max_value.maxRetweetsWithComments,
          L_Rt_Rtk_NK_positive_max_value.maxRetweetsWithComments,
          NL_Rt_Rtk_K_positive_max_value.maxRetweetsWithComments,
          L_Rt_NRtk_K_positive_max_value.maxRetweetsWithComments,
          L_NRt_Rtk_K_positive_max_value.maxRetweetsWithComments,
          L_Rt_Rtk_K_positive_max_value.maxRetweetsWithComments
        ),
        sumPositiveMaxComments: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_positive_max_value.maxComments +
            NL_NRt_NRtk_K_positive_max_value.maxComments +
            NL_NRt_Rtk_NK_positive_max_value.maxComments +
            NL_Rt_NRtk_NK_positive_max_value.maxComments +
            L_NRt_NRtk_NK_positive_max_value.maxComments +
            NL_NRt_Rtk_K_positive_max_value.maxComments +
            NL_Rt_NRtk_K_positive_max_value.maxComments +
            L_NRt_NRtk_K_positive_max_value.maxComments +
            NL_Rt_Rtk_NK_positive_max_value.maxComments +
            L_NRt_Rtk_NK_positive_max_value.maxComments +
            L_Rt_NRtk_NK_positive_max_value.maxComments +
            L_Rt_Rtk_NK_positive_max_value.maxComments +
            NL_Rt_Rtk_K_positive_max_value.maxComments +
            L_Rt_NRtk_K_positive_max_value.maxComments +
            L_NRt_Rtk_K_positive_max_value.maxComments +
            L_Rt_Rtk_K_positive_max_value.maxComments
          ).toFixed(2)
        ),
        byGspPositiveCommentHighestValue: Math.max(
          NL_NRt_NRtk_NK_positive_max_value.maxComments,
          NL_NRt_NRtk_K_positive_max_value.maxComments,
          NL_NRt_Rtk_NK_positive_max_value.maxComments,
          NL_Rt_NRtk_NK_positive_max_value.maxComments,
          L_NRt_NRtk_NK_positive_max_value.maxComments,
          NL_NRt_Rtk_K_positive_max_value.maxComments,
          NL_Rt_NRtk_K_positive_max_value.maxComments,
          L_NRt_NRtk_K_positive_max_value.maxComments,
          NL_Rt_Rtk_NK_positive_max_value.maxComments,
          L_NRt_Rtk_NK_positive_max_value.maxComments,
          L_Rt_NRtk_NK_positive_max_value.maxComments,
          L_Rt_Rtk_NK_positive_max_value.maxComments,
          NL_Rt_Rtk_K_positive_max_value.maxComments,
          L_Rt_NRtk_K_positive_max_value.maxComments,
          L_NRt_Rtk_K_positive_max_value.maxComments,
          L_Rt_Rtk_K_positive_max_value.maxComments
        ),
        sumNegativeMaxLikes: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_negative_max_value.maxLikes +
            NL_NRt_NRtk_K_negative_max_value.maxLikes +
            NL_NRt_Rtk_NK_negative_max_value.maxLikes +
            NL_Rt_NRtk_NK_negative_max_value.maxLikes +
            L_NRt_NRtk_NK_negative_max_value.maxLikes +
            NL_NRt_Rtk_K_negative_max_value.maxLikes +
            NL_Rt_NRtk_K_negative_max_value.maxLikes +
            L_NRt_NRtk_K_negative_max_value.maxLikes +
            NL_Rt_Rtk_NK_negative_max_value.maxLikes +
            L_NRt_Rtk_NK_negative_max_value.maxLikes +
            L_Rt_NRtk_NK_negative_max_value.maxLikes +
            L_Rt_Rtk_NK_negative_max_value.maxLikes +
            NL_Rt_Rtk_K_negative_max_value.maxLikes +
            L_Rt_NRtk_K_negative_max_value.maxLikes +
            L_NRt_Rtk_K_negative_max_value.maxLikes +
            L_Rt_Rtk_K_negative_max_value.maxLikes
          ).toFixed(2)
        ),
        byGspNegativeLikeHighestValue: Math.max(
          NL_NRt_NRtk_NK_negative_max_value.maxLikes,
          NL_NRt_NRtk_K_negative_max_value.maxLikes,
          NL_NRt_Rtk_NK_negative_max_value.maxLikes,
          NL_Rt_NRtk_NK_negative_max_value.maxLikes,
          L_NRt_NRtk_NK_negative_max_value.maxLikes,
          NL_NRt_Rtk_K_negative_max_value.maxLikes,
          NL_Rt_NRtk_K_negative_max_value.maxLikes,
          L_NRt_NRtk_K_negative_max_value.maxLikes,
          NL_Rt_Rtk_NK_negative_max_value.maxLikes,
          L_NRt_Rtk_NK_negative_max_value.maxLikes,
          L_Rt_NRtk_NK_negative_max_value.maxLikes,
          L_Rt_Rtk_NK_negative_max_value.maxLikes,
          NL_Rt_Rtk_K_negative_max_value.maxLikes,
          L_Rt_NRtk_K_negative_max_value.maxLikes,
          L_NRt_Rtk_K_negative_max_value.maxLikes,
          L_Rt_Rtk_K_negative_max_value.maxLikes
        ),
        sumNegativeMaxRetweets: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_negative_max_value.maxRetweets +
            NL_NRt_NRtk_K_negative_max_value.maxRetweets +
            NL_NRt_Rtk_NK_negative_max_value.maxRetweets +
            NL_Rt_NRtk_NK_negative_max_value.maxRetweets +
            L_NRt_NRtk_NK_negative_max_value.maxRetweets +
            NL_NRt_Rtk_K_negative_max_value.maxRetweets +
            NL_Rt_NRtk_K_negative_max_value.maxRetweets +
            L_NRt_NRtk_K_negative_max_value.maxRetweets +
            NL_Rt_Rtk_NK_negative_max_value.maxRetweets +
            L_NRt_Rtk_NK_negative_max_value.maxRetweets +
            L_Rt_NRtk_NK_negative_max_value.maxRetweets +
            L_Rt_Rtk_NK_negative_max_value.maxRetweets +
            NL_Rt_Rtk_K_negative_max_value.maxRetweets +
            L_Rt_NRtk_K_negative_max_value.maxRetweets +
            L_NRt_Rtk_K_negative_max_value.maxRetweets +
            L_Rt_Rtk_K_negative_max_value.maxRetweets
          ).toFixed(2)
        ),
        byGspNegativeRetweetHighestValue: Math.max(
          NL_NRt_NRtk_NK_negative_max_value.maxRetweets,
          NL_NRt_NRtk_K_negative_max_value.maxRetweets,
          NL_NRt_Rtk_NK_negative_max_value.maxRetweets,
          NL_Rt_NRtk_NK_negative_max_value.maxRetweets,
          L_NRt_NRtk_NK_negative_max_value.maxRetweets,
          NL_NRt_Rtk_K_negative_max_value.maxRetweets,
          NL_Rt_NRtk_K_negative_max_value.maxRetweets,
          L_NRt_NRtk_K_negative_max_value.maxRetweets,
          NL_Rt_Rtk_NK_negative_max_value.maxRetweets,
          L_NRt_Rtk_NK_negative_max_value.maxRetweets,
          L_Rt_NRtk_NK_negative_max_value.maxRetweets,
          L_Rt_Rtk_NK_negative_max_value.maxRetweets,
          NL_Rt_Rtk_K_negative_max_value.maxRetweets,
          L_Rt_NRtk_K_negative_max_value.maxRetweets,
          L_NRt_Rtk_K_negative_max_value.maxRetweets,
          L_Rt_Rtk_K_negative_max_value.maxRetweets
        ),
        sumNegativeMaxRetweetsWithComments: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_negative_max_value.maxRetweetsWithComments +
            NL_NRt_NRtk_K_negative_max_value.maxRetweetsWithComments +
            NL_NRt_Rtk_NK_negative_max_value.maxRetweetsWithComments +
            NL_Rt_NRtk_NK_negative_max_value.maxRetweetsWithComments +
            L_NRt_NRtk_NK_negative_max_value.maxRetweetsWithComments +
            NL_NRt_Rtk_K_negative_max_value.maxRetweetsWithComments +
            NL_Rt_NRtk_K_negative_max_value.maxRetweetsWithComments +
            L_NRt_NRtk_K_negative_max_value.maxRetweetsWithComments +
            NL_Rt_Rtk_NK_negative_max_value.maxRetweetsWithComments +
            L_NRt_Rtk_NK_negative_max_value.maxRetweetsWithComments +
            L_Rt_NRtk_NK_negative_max_value.maxRetweetsWithComments +
            L_Rt_Rtk_NK_negative_max_value.maxRetweetsWithComments +
            NL_Rt_Rtk_K_negative_max_value.maxRetweetsWithComments +
            L_Rt_NRtk_K_negative_max_value.maxRetweetsWithComments +
            L_NRt_Rtk_K_negative_max_value.maxRetweetsWithComments +
            L_Rt_Rtk_K_negative_max_value.maxRetweetsWithComments
          ).toFixed(2)
        ),
        byGspNegativeRetweetWithCommentHighestValue: Math.max(
          NL_NRt_NRtk_NK_negative_max_value.maxRetweetsWithComments,
          NL_NRt_NRtk_K_negative_max_value.maxRetweetsWithComments,
          NL_NRt_Rtk_NK_negative_max_value.maxRetweetsWithComments,
          NL_Rt_NRtk_NK_negative_max_value.maxRetweetsWithComments,
          L_NRt_NRtk_NK_negative_max_value.maxRetweetsWithComments,
          NL_NRt_Rtk_K_negative_max_value.maxRetweetsWithComments,
          NL_Rt_NRtk_K_negative_max_value.maxRetweetsWithComments,
          L_NRt_NRtk_K_negative_max_value.maxRetweetsWithComments,
          NL_Rt_Rtk_NK_negative_max_value.maxRetweetsWithComments,
          L_NRt_Rtk_NK_negative_max_value.maxRetweetsWithComments,
          L_Rt_NRtk_NK_negative_max_value.maxRetweetsWithComments,
          L_Rt_Rtk_NK_negative_max_value.maxRetweetsWithComments,
          NL_Rt_Rtk_K_negative_max_value.maxRetweetsWithComments,
          L_Rt_NRtk_K_negative_max_value.maxRetweetsWithComments,
          L_NRt_Rtk_K_negative_max_value.maxRetweetsWithComments,
          L_Rt_Rtk_K_negative_max_value.maxRetweetsWithComments
        ),
        sumNegativeMaxComments: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_negative_max_value.maxComments +
            NL_NRt_NRtk_K_negative_max_value.maxComments +
            NL_NRt_Rtk_NK_negative_max_value.maxComments +
            NL_Rt_NRtk_NK_negative_max_value.maxComments +
            L_NRt_NRtk_NK_negative_max_value.maxComments +
            NL_NRt_Rtk_K_negative_max_value.maxComments +
            NL_Rt_NRtk_K_negative_max_value.maxComments +
            L_NRt_NRtk_K_negative_max_value.maxComments +
            NL_Rt_Rtk_NK_negative_max_value.maxComments +
            L_NRt_Rtk_NK_negative_max_value.maxComments +
            L_Rt_NRtk_NK_negative_max_value.maxComments +
            L_Rt_Rtk_NK_negative_max_value.maxComments +
            NL_Rt_Rtk_K_negative_max_value.maxComments +
            L_Rt_NRtk_K_negative_max_value.maxComments +
            L_NRt_Rtk_K_negative_max_value.maxComments +
            L_Rt_Rtk_K_negative_max_value.maxComments
          ).toFixed(2)
        ),
        byGspNegativeCommentHighestValue: Math.max(
          NL_NRt_NRtk_NK_negative_max_value.maxComments,
          NL_NRt_NRtk_K_negative_max_value.maxComments,
          NL_NRt_Rtk_NK_negative_max_value.maxComments,
          NL_Rt_NRtk_NK_negative_max_value.maxComments,
          L_NRt_NRtk_NK_negative_max_value.maxComments,
          NL_NRt_Rtk_K_negative_max_value.maxComments,
          NL_Rt_NRtk_K_negative_max_value.maxComments,
          L_NRt_NRtk_K_negative_max_value.maxComments,
          NL_Rt_Rtk_NK_negative_max_value.maxComments,
          L_NRt_Rtk_NK_negative_max_value.maxComments,
          L_Rt_NRtk_NK_negative_max_value.maxComments,
          L_Rt_Rtk_NK_negative_max_value.maxComments,
          NL_Rt_Rtk_K_negative_max_value.maxComments,
          L_Rt_NRtk_K_negative_max_value.maxComments,
          L_NRt_Rtk_K_negative_max_value.maxComments,
          L_Rt_Rtk_K_negative_max_value.maxComments
        ),
        sumNeutralMaxLikes: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_neutral_max_value.maxLikes +
            NL_NRt_NRtk_K_neutral_max_value.maxLikes +
            NL_NRt_Rtk_NK_neutral_max_value.maxLikes +
            NL_Rt_NRtk_NK_neutral_max_value.maxLikes +
            L_NRt_NRtk_NK_neutral_max_value.maxLikes +
            NL_NRt_Rtk_K_neutral_max_value.maxLikes +
            NL_Rt_NRtk_K_neutral_max_value.maxLikes +
            L_NRt_NRtk_K_neutral_max_value.maxLikes +
            NL_Rt_Rtk_NK_neutral_max_value.maxLikes +
            L_NRt_Rtk_NK_neutral_max_value.maxLikes +
            L_Rt_NRtk_NK_neutral_max_value.maxLikes +
            L_Rt_Rtk_NK_neutral_max_value.maxLikes +
            NL_Rt_Rtk_K_neutral_max_value.maxLikes +
            L_Rt_NRtk_K_neutral_max_value.maxLikes +
            L_NRt_Rtk_K_neutral_max_value.maxLikes +
            L_Rt_Rtk_K_neutral_max_value.maxLikes
          ).toFixed(2)
        ),
        byGspNeutralLikeHighestValue: Math.max(
          NL_NRt_NRtk_NK_neutral_max_value.maxLikes,
          NL_NRt_NRtk_K_neutral_max_value.maxLikes,
          NL_NRt_Rtk_NK_neutral_max_value.maxLikes,
          NL_Rt_NRtk_NK_neutral_max_value.maxLikes,
          L_NRt_NRtk_NK_neutral_max_value.maxLikes,
          NL_NRt_Rtk_K_neutral_max_value.maxLikes,
          NL_Rt_NRtk_K_neutral_max_value.maxLikes,
          L_NRt_NRtk_K_neutral_max_value.maxLikes,
          NL_Rt_Rtk_NK_neutral_max_value.maxLikes,
          L_NRt_Rtk_NK_neutral_max_value.maxLikes,
          L_Rt_NRtk_NK_neutral_max_value.maxLikes,
          L_Rt_Rtk_NK_neutral_max_value.maxLikes,
          NL_Rt_Rtk_K_neutral_max_value.maxLikes,
          L_Rt_NRtk_K_neutral_max_value.maxLikes,
          L_NRt_Rtk_K_neutral_max_value.maxLikes,
          L_Rt_Rtk_K_neutral_max_value.maxLikes
        ),
        sumNeutralMaxRetweets: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_neutral_max_value.maxRetweets +
            NL_NRt_NRtk_K_neutral_max_value.maxRetweets +
            NL_NRt_Rtk_NK_neutral_max_value.maxRetweets +
            NL_Rt_NRtk_NK_neutral_max_value.maxRetweets +
            L_NRt_NRtk_NK_neutral_max_value.maxRetweets +
            NL_NRt_Rtk_K_neutral_max_value.maxRetweets +
            NL_Rt_NRtk_K_neutral_max_value.maxRetweets +
            L_NRt_NRtk_K_neutral_max_value.maxRetweets +
            NL_Rt_Rtk_NK_neutral_max_value.maxRetweets +
            L_NRt_Rtk_NK_neutral_max_value.maxRetweets +
            L_Rt_NRtk_NK_neutral_max_value.maxRetweets +
            L_Rt_Rtk_NK_neutral_max_value.maxRetweets +
            NL_Rt_Rtk_K_neutral_max_value.maxRetweets +
            L_Rt_NRtk_K_neutral_max_value.maxRetweets +
            L_NRt_Rtk_K_neutral_max_value.maxRetweets +
            L_Rt_Rtk_K_neutral_max_value.maxRetweets
          ).toFixed(2)
        ),
        byGspNeutralRetweetHighestValue: Math.max(
          NL_NRt_NRtk_NK_neutral_max_value.maxRetweets,
          NL_NRt_NRtk_K_neutral_max_value.maxRetweets,
          NL_NRt_Rtk_NK_neutral_max_value.maxRetweets,
          NL_Rt_NRtk_NK_neutral_max_value.maxRetweets,
          L_NRt_NRtk_NK_neutral_max_value.maxRetweets,
          NL_NRt_Rtk_K_neutral_max_value.maxRetweets,
          NL_Rt_NRtk_K_neutral_max_value.maxRetweets,
          L_NRt_NRtk_K_neutral_max_value.maxRetweets,
          NL_Rt_Rtk_NK_neutral_max_value.maxRetweets,
          L_NRt_Rtk_NK_neutral_max_value.maxRetweets,
          L_Rt_NRtk_NK_neutral_max_value.maxRetweets,
          L_Rt_Rtk_NK_neutral_max_value.maxRetweets,
          NL_Rt_Rtk_K_neutral_max_value.maxRetweets,
          L_Rt_NRtk_K_neutral_max_value.maxRetweets,
          L_NRt_Rtk_K_neutral_max_value.maxRetweets,
          L_Rt_Rtk_K_neutral_max_value.maxRetweets
        ),
        sumNeutralMaxRetweetsWithComments: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_neutral_max_value.maxRetweetsWithComments +
            NL_NRt_NRtk_K_neutral_max_value.maxRetweetsWithComments +
            NL_NRt_Rtk_NK_neutral_max_value.maxRetweetsWithComments +
            NL_Rt_NRtk_NK_neutral_max_value.maxRetweetsWithComments +
            L_NRt_NRtk_NK_neutral_max_value.maxRetweetsWithComments +
            NL_NRt_Rtk_K_neutral_max_value.maxRetweetsWithComments +
            NL_Rt_NRtk_K_neutral_max_value.maxRetweetsWithComments +
            L_NRt_NRtk_K_neutral_max_value.maxRetweetsWithComments +
            NL_Rt_Rtk_NK_neutral_max_value.maxRetweetsWithComments +
            L_NRt_Rtk_NK_neutral_max_value.maxRetweetsWithComments +
            L_Rt_NRtk_NK_neutral_max_value.maxRetweetsWithComments +
            L_Rt_Rtk_NK_neutral_max_value.maxRetweetsWithComments +
            NL_Rt_Rtk_K_neutral_max_value.maxRetweetsWithComments +
            L_Rt_NRtk_K_neutral_max_value.maxRetweetsWithComments +
            L_NRt_Rtk_K_neutral_max_value.maxRetweetsWithComments +
            L_Rt_Rtk_K_neutral_max_value.maxRetweetsWithComments
          ).toFixed(2)
        ),
        byGspNeutralRetweetWithCommentHighestValue: Math.max(
          NL_NRt_NRtk_NK_neutral_max_value.maxRetweetsWithComments,
          NL_NRt_NRtk_K_neutral_max_value.maxRetweetsWithComments,
          NL_NRt_Rtk_NK_neutral_max_value.maxRetweetsWithComments,
          NL_Rt_NRtk_NK_neutral_max_value.maxRetweetsWithComments,
          L_NRt_NRtk_NK_neutral_max_value.maxRetweetsWithComments,
          NL_NRt_Rtk_K_neutral_max_value.maxRetweetsWithComments,
          NL_Rt_NRtk_K_neutral_max_value.maxRetweetsWithComments,
          L_NRt_NRtk_K_neutral_max_value.maxRetweetsWithComments,
          NL_Rt_Rtk_NK_neutral_max_value.maxRetweetsWithComments,
          L_NRt_Rtk_NK_neutral_max_value.maxRetweetsWithComments,
          L_Rt_NRtk_NK_neutral_max_value.maxRetweetsWithComments,
          L_Rt_Rtk_NK_neutral_max_value.maxRetweetsWithComments,
          NL_Rt_Rtk_K_neutral_max_value.maxRetweetsWithComments,
          L_Rt_NRtk_K_neutral_max_value.maxRetweetsWithComments,
          L_NRt_Rtk_K_neutral_max_value.maxRetweetsWithComments,
          L_Rt_Rtk_K_neutral_max_value.maxRetweetsWithComments
        ),
        sumNeutralMaxComments: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_neutral_max_value.maxComments +
            NL_NRt_NRtk_K_neutral_max_value.maxComments +
            NL_NRt_Rtk_NK_neutral_max_value.maxComments +
            NL_Rt_NRtk_NK_neutral_max_value.maxComments +
            L_NRt_NRtk_NK_neutral_max_value.maxComments +
            NL_NRt_Rtk_K_neutral_max_value.maxComments +
            NL_Rt_NRtk_K_neutral_max_value.maxComments +
            L_NRt_NRtk_K_neutral_max_value.maxComments +
            NL_Rt_Rtk_NK_neutral_max_value.maxComments +
            L_NRt_Rtk_NK_neutral_max_value.maxComments +
            L_Rt_NRtk_NK_neutral_max_value.maxComments +
            L_Rt_Rtk_NK_neutral_max_value.maxComments +
            NL_Rt_Rtk_K_neutral_max_value.maxComments +
            L_Rt_NRtk_K_neutral_max_value.maxComments +
            L_NRt_Rtk_K_neutral_max_value.maxComments +
            L_Rt_Rtk_K_neutral_max_value.maxComments
          ).toFixed(2)
        ),
        byGspNeutralCommentHighestValue: Math.max(
          NL_NRt_NRtk_NK_neutral_max_value.maxComments,
          NL_NRt_NRtk_K_neutral_max_value.maxComments,
          NL_NRt_Rtk_NK_neutral_max_value.maxComments,
          NL_Rt_NRtk_NK_neutral_max_value.maxComments,
          L_NRt_NRtk_NK_neutral_max_value.maxComments,
          NL_NRt_Rtk_K_neutral_max_value.maxComments,
          NL_Rt_NRtk_K_neutral_max_value.maxComments,
          L_NRt_NRtk_K_neutral_max_value.maxComments,
          NL_Rt_Rtk_NK_neutral_max_value.maxComments,
          L_NRt_Rtk_NK_neutral_max_value.maxComments,
          L_Rt_NRtk_NK_neutral_max_value.maxComments,
          L_Rt_Rtk_NK_neutral_max_value.maxComments,
          NL_Rt_Rtk_K_neutral_max_value.maxComments,
          L_Rt_NRtk_K_neutral_max_value.maxComments,
          L_NRt_Rtk_K_neutral_max_value.maxComments,
          L_Rt_Rtk_K_neutral_max_value.maxComments
        ),
        sumNClassMaxLikes: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_nclass_max_value.maxLikes +
            NL_NRt_NRtk_K_nclass_max_value.maxLikes +
            NL_NRt_Rtk_NK_nclass_max_value.maxLikes +
            NL_Rt_NRtk_NK_nclass_max_value.maxLikes +
            L_NRt_NRtk_NK_nclass_max_value.maxLikes +
            NL_NRt_Rtk_K_nclass_max_value.maxLikes +
            NL_Rt_NRtk_K_nclass_max_value.maxLikes +
            L_NRt_NRtk_K_nclass_max_value.maxLikes +
            NL_Rt_Rtk_NK_nclass_max_value.maxLikes +
            L_NRt_Rtk_NK_nclass_max_value.maxLikes +
            L_Rt_NRtk_NK_nclass_max_value.maxLikes +
            L_Rt_Rtk_NK_nclass_max_value.maxLikes +
            NL_Rt_Rtk_K_nclass_max_value.maxLikes +
            L_Rt_NRtk_K_nclass_max_value.maxLikes +
            L_NRt_Rtk_K_nclass_max_value.maxLikes +
            L_Rt_Rtk_K_nclass_max_value.maxLikes
          ).toFixed(2)
        ),
        byGspNClassLikeHighestValue: Math.max(
          NL_NRt_NRtk_NK_nclass_max_value.maxLikes,
          NL_NRt_NRtk_K_nclass_max_value.maxLikes,
          NL_NRt_Rtk_NK_nclass_max_value.maxLikes,
          NL_Rt_NRtk_NK_nclass_max_value.maxLikes,
          L_NRt_NRtk_NK_nclass_max_value.maxLikes,
          NL_NRt_Rtk_K_nclass_max_value.maxLikes,
          NL_Rt_NRtk_K_nclass_max_value.maxLikes,
          L_NRt_NRtk_K_nclass_max_value.maxLikes,
          NL_Rt_Rtk_NK_nclass_max_value.maxLikes,
          L_NRt_Rtk_NK_nclass_max_value.maxLikes,
          L_Rt_NRtk_NK_nclass_max_value.maxLikes,
          L_Rt_Rtk_NK_nclass_max_value.maxLikes,
          NL_Rt_Rtk_K_nclass_max_value.maxLikes,
          L_Rt_NRtk_K_nclass_max_value.maxLikes,
          L_NRt_Rtk_K_nclass_max_value.maxLikes,
          L_Rt_Rtk_K_nclass_max_value.maxLikes
        ),
        sumNClassMaxRetweets: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_nclass_max_value.maxRetweets +
            NL_NRt_NRtk_K_nclass_max_value.maxRetweets +
            NL_NRt_Rtk_NK_nclass_max_value.maxRetweets +
            NL_Rt_NRtk_NK_nclass_max_value.maxRetweets +
            L_NRt_NRtk_NK_nclass_max_value.maxRetweets +
            NL_NRt_Rtk_K_nclass_max_value.maxRetweets +
            NL_Rt_NRtk_K_nclass_max_value.maxRetweets +
            L_NRt_NRtk_K_nclass_max_value.maxRetweets +
            NL_Rt_Rtk_NK_nclass_max_value.maxRetweets +
            L_NRt_Rtk_NK_nclass_max_value.maxRetweets +
            L_Rt_NRtk_NK_nclass_max_value.maxRetweets +
            L_Rt_Rtk_NK_nclass_max_value.maxRetweets +
            NL_Rt_Rtk_K_nclass_max_value.maxRetweets +
            L_Rt_NRtk_K_nclass_max_value.maxRetweets +
            L_NRt_Rtk_K_nclass_max_value.maxRetweets +
            L_Rt_Rtk_K_nclass_max_value.maxRetweets
          ).toFixed(2)
        ),
        byGspNClassRetweetHighestValue: Math.max(
          NL_NRt_NRtk_NK_nclass_max_value.maxRetweets,
          NL_NRt_NRtk_K_nclass_max_value.maxRetweets,
          NL_NRt_Rtk_NK_nclass_max_value.maxRetweets,
          NL_Rt_NRtk_NK_nclass_max_value.maxRetweets,
          L_NRt_NRtk_NK_nclass_max_value.maxRetweets,
          NL_NRt_Rtk_K_nclass_max_value.maxRetweets,
          NL_Rt_NRtk_K_nclass_max_value.maxRetweets,
          L_NRt_NRtk_K_nclass_max_value.maxRetweets,
          NL_Rt_Rtk_NK_nclass_max_value.maxRetweets,
          L_NRt_Rtk_NK_nclass_max_value.maxRetweets,
          L_Rt_NRtk_NK_nclass_max_value.maxRetweets,
          L_Rt_Rtk_NK_nclass_max_value.maxRetweets,
          NL_Rt_Rtk_K_nclass_max_value.maxRetweets,
          L_Rt_NRtk_K_nclass_max_value.maxRetweets,
          L_NRt_Rtk_K_nclass_max_value.maxRetweets,
          L_Rt_Rtk_K_nclass_max_value.maxRetweets
        ),
        sumNClassMaxRetweetsWithComments: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_nclass_max_value.maxRetweetsWithComments +
            NL_NRt_NRtk_K_nclass_max_value.maxRetweetsWithComments +
            NL_NRt_Rtk_NK_nclass_max_value.maxRetweetsWithComments +
            NL_Rt_NRtk_NK_nclass_max_value.maxRetweetsWithComments +
            L_NRt_NRtk_NK_nclass_max_value.maxRetweetsWithComments +
            NL_NRt_Rtk_K_nclass_max_value.maxRetweetsWithComments +
            NL_Rt_NRtk_K_nclass_max_value.maxRetweetsWithComments +
            L_NRt_NRtk_K_nclass_max_value.maxRetweetsWithComments +
            NL_Rt_Rtk_NK_nclass_max_value.maxRetweetsWithComments +
            L_NRt_Rtk_NK_nclass_max_value.maxRetweetsWithComments +
            L_Rt_NRtk_NK_nclass_max_value.maxRetweetsWithComments +
            L_Rt_Rtk_NK_nclass_max_value.maxRetweetsWithComments +
            NL_Rt_Rtk_K_nclass_max_value.maxRetweetsWithComments +
            L_Rt_NRtk_K_nclass_max_value.maxRetweetsWithComments +
            L_NRt_Rtk_K_nclass_max_value.maxRetweetsWithComments +
            L_Rt_Rtk_K_nclass_max_value.maxRetweetsWithComments
          ).toFixed(2)
        ),
        byGspNClassRetweetWithCommentHighestValue: Math.max(
          NL_NRt_NRtk_NK_nclass_max_value.maxRetweetsWithComments,
          NL_NRt_NRtk_K_nclass_max_value.maxRetweetsWithComments,
          NL_NRt_Rtk_NK_nclass_max_value.maxRetweetsWithComments,
          NL_Rt_NRtk_NK_nclass_max_value.maxRetweetsWithComments,
          L_NRt_NRtk_NK_nclass_max_value.maxRetweetsWithComments,
          NL_NRt_Rtk_K_nclass_max_value.maxRetweetsWithComments,
          NL_Rt_NRtk_K_nclass_max_value.maxRetweetsWithComments,
          L_NRt_NRtk_K_nclass_max_value.maxRetweetsWithComments,
          NL_Rt_Rtk_NK_nclass_max_value.maxRetweetsWithComments,
          L_NRt_Rtk_NK_nclass_max_value.maxRetweetsWithComments,
          L_Rt_NRtk_NK_nclass_max_value.maxRetweetsWithComments,
          L_Rt_Rtk_NK_nclass_max_value.maxRetweetsWithComments,
          NL_Rt_Rtk_K_nclass_max_value.maxRetweetsWithComments,
          L_Rt_NRtk_K_nclass_max_value.maxRetweetsWithComments,
          L_NRt_Rtk_K_nclass_max_value.maxRetweetsWithComments,
          L_Rt_Rtk_K_nclass_max_value.maxRetweetsWithComments
        ),
        sumNClassMaxComments: format_number_pt_br(
          (
            NL_NRt_NRtk_NK_nclass_max_value.maxComments +
            NL_NRt_NRtk_K_nclass_max_value.maxComments +
            NL_NRt_Rtk_NK_nclass_max_value.maxComments +
            NL_Rt_NRtk_NK_nclass_max_value.maxComments +
            L_NRt_NRtk_NK_nclass_max_value.maxComments +
            NL_NRt_Rtk_K_nclass_max_value.maxComments +
            NL_Rt_NRtk_K_nclass_max_value.maxComments +
            L_NRt_NRtk_K_nclass_max_value.maxComments +
            NL_Rt_Rtk_NK_nclass_max_value.maxComments +
            L_NRt_Rtk_NK_nclass_max_value.maxComments +
            L_Rt_NRtk_NK_nclass_max_value.maxComments +
            L_Rt_Rtk_NK_nclass_max_value.maxComments +
            NL_Rt_Rtk_K_nclass_max_value.maxComments +
            L_Rt_NRtk_K_nclass_max_value.maxComments +
            L_NRt_Rtk_K_nclass_max_value.maxComments +
            L_Rt_Rtk_K_nclass_max_value.maxComments
          ).toFixed(2)
        ),
        byGspNClassCommentHighestValue: Math.max(
          NL_NRt_NRtk_NK_nclass_max_value.maxComments,
          NL_NRt_NRtk_K_nclass_max_value.maxComments,
          NL_NRt_Rtk_NK_nclass_max_value.maxComments,
          NL_Rt_NRtk_NK_nclass_max_value.maxComments,
          L_NRt_NRtk_NK_nclass_max_value.maxComments,
          NL_NRt_Rtk_K_nclass_max_value.maxComments,
          NL_Rt_NRtk_K_nclass_max_value.maxComments,
          L_NRt_NRtk_K_nclass_max_value.maxComments,
          NL_Rt_Rtk_NK_nclass_max_value.maxComments,
          L_NRt_Rtk_NK_nclass_max_value.maxComments,
          L_Rt_NRtk_NK_nclass_max_value.maxComments,
          L_Rt_Rtk_NK_nclass_max_value.maxComments,
          NL_Rt_Rtk_K_nclass_max_value.maxComments,
          L_Rt_NRtk_K_nclass_max_value.maxComments,
          L_NRt_Rtk_K_nclass_max_value.maxComments,
          L_Rt_Rtk_K_nclass_max_value.maxComments
        ),
      };

      const vCBSActiveUsers = {
        vCBS:
          Math.max(
            sum_reports.byGspHighestLikeValue,
            sum_reports.byGspHighestRetweetValue,
            sum_reports.byGspHighestRetweetWithCommentValue,
            sum_reports.byGspHighestCommentValue
          ) || 1,
        vCBSPositive:
          Math.max(
            sum_reports.byGspHighestLikeValue,
            sum_reports.byGspHighestRetweetValue,
            sum_reports.byGspHighestRetweetWithCommentValue,
            sum_reports.byGspHighestCommentValue
          ) || 1,
        vCBSNegative:
          Math.max(
            sum_reports.byGspHighestLikeValue,
            sum_reports.byGspHighestRetweetValue,
            sum_reports.byGspHighestRetweetWithCommentValue,
            sum_reports.byGspHighestCommentValue
          ) || 1,
        vCBSNeutral:
          Math.max(
            sum_reports.byGspHighestLikeValue,
            sum_reports.byGspHighestRetweetValue,
            sum_reports.byGspHighestRetweetWithCommentValue,
            sum_reports.byGspHighestCommentValue
          ) || 1,
        vCBSNClass:
          Math.max(
            sum_reports.byGspHighestLikeValue,
            sum_reports.byGspHighestRetweetValue,
            sum_reports.byGspHighestRetweetWithCommentValue,
            sum_reports.byGspHighestCommentValue
          ) || 1,
      };

      const vCBSInactiveUsers = {
        vCBS: user_interactions_value_vcsb.followers - vCBSActiveUsers.vCBS,
        vCBSPositive:
          user_interactions_value_vcsb.followers - vCBSActiveUsers.vCBSPositive,
        vCBSNegative:
          user_interactions_value_vcsb.followers - vCBSActiveUsers.vCBSNegative,
        vCBSNeutral:
          user_interactions_value_vcsb.followers - vCBSActiveUsers.vCBSNeutral,
        vCBSNClass:
          user_interactions_value_vcsb.followers - vCBSActiveUsers.vCBSNClass,
      };

      const sumGspFreq =
        NL_NRt_NRtk_NK.freq +
        NL_NRt_NRtk_K.freq +
        NL_NRt_Rtk_NK.freq +
        NL_Rt_NRtk_NK.freq +
        L_NRt_NRtk_NK.freq +
        NL_NRt_Rtk_K.freq +
        NL_Rt_NRtk_K.freq +
        L_NRt_NRtk_K.freq +
        NL_Rt_Rtk_NK.freq +
        L_NRt_Rtk_NK.freq +
        L_Rt_NRtk_NK.freq +
        L_Rt_Rtk_NK.freq +
        NL_Rt_Rtk_K.freq +
        L_Rt_NRtk_K.freq +
        L_NRt_Rtk_K.freq +
        L_Rt_Rtk_K.freq;

      const sumGspFreqWithoutFormat = (
        NL_NRt_NRtk_NK.freq +
        NL_NRt_NRtk_K.freq +
        NL_NRt_Rtk_NK.freq +
        NL_Rt_NRtk_NK.freq +
        L_NRt_NRtk_NK.freq +
        NL_NRt_Rtk_K.freq +
        NL_Rt_NRtk_K.freq +
        L_NRt_NRtk_K.freq +
        NL_Rt_Rtk_NK.freq +
        L_NRt_Rtk_NK.freq +
        L_Rt_NRtk_NK.freq +
        L_Rt_Rtk_NK.freq +
        NL_Rt_Rtk_K.freq +
        L_Rt_NRtk_K.freq +
        L_NRt_Rtk_K.freq +
        L_Rt_Rtk_K.freq
      ).toFixed(2);

      const sumGspAverageLikes = format_number_pt_br(
        (
          NL_NRt_NRtk_NK.average_likes +
          NL_NRt_NRtk_K.average_likes +
          NL_NRt_Rtk_NK.average_likes +
          NL_Rt_NRtk_NK.average_likes +
          L_NRt_NRtk_NK.average_likes +
          NL_NRt_Rtk_K.average_likes +
          NL_Rt_NRtk_K.average_likes +
          L_NRt_NRtk_K.average_likes +
          NL_Rt_Rtk_NK.average_likes +
          L_NRt_Rtk_NK.average_likes +
          L_Rt_NRtk_NK.average_likes +
          L_Rt_Rtk_NK.average_likes +
          NL_Rt_Rtk_K.average_likes +
          L_Rt_NRtk_K.average_likes +
          L_NRt_Rtk_K.average_likes +
          L_Rt_Rtk_K.average_likes
        ).toFixed(2)
      );

      const sumGspAverageRetweets = format_number_pt_br(
        (
          NL_NRt_NRtk_NK.average_retweets +
          NL_NRt_NRtk_K.average_retweets +
          NL_NRt_Rtk_NK.average_retweets +
          NL_Rt_NRtk_NK.average_retweets +
          L_NRt_NRtk_NK.average_retweets +
          NL_NRt_Rtk_K.average_retweets +
          NL_Rt_NRtk_K.average_retweets +
          L_NRt_NRtk_K.average_retweets +
          NL_Rt_Rtk_NK.average_retweets +
          L_NRt_Rtk_NK.average_retweets +
          L_Rt_NRtk_NK.average_retweets +
          L_Rt_Rtk_NK.average_retweets +
          NL_Rt_Rtk_K.average_retweets +
          L_Rt_NRtk_K.average_retweets +
          L_NRt_Rtk_K.average_retweets +
          L_Rt_Rtk_K.average_retweets
        ).toFixed(2)
      );

      const sumGspAverageRetweetsWithComments = format_number_pt_br(
        (
          NL_NRt_NRtk_NK.average_retweets_with_comments +
          NL_NRt_NRtk_K.average_retweets_with_comments +
          NL_NRt_Rtk_NK.average_retweets_with_comments +
          NL_Rt_NRtk_NK.average_retweets_with_comments +
          L_NRt_NRtk_NK.average_retweets_with_comments +
          NL_NRt_Rtk_K.average_retweets_with_comments +
          NL_Rt_NRtk_K.average_retweets_with_comments +
          L_NRt_NRtk_K.average_retweets_with_comments +
          NL_Rt_Rtk_NK.average_retweets_with_comments +
          L_NRt_Rtk_NK.average_retweets_with_comments +
          L_Rt_NRtk_NK.average_retweets_with_comments +
          L_Rt_Rtk_NK.average_retweets_with_comments +
          NL_Rt_Rtk_K.average_retweets_with_comments +
          L_Rt_NRtk_K.average_retweets_with_comments +
          L_NRt_Rtk_K.average_retweets_with_comments +
          L_Rt_Rtk_K.average_retweets_with_comments
        ).toFixed(2)
      );

      const sumGspAverageComments = format_number_pt_br(
        (
          NL_NRt_NRtk_NK.average_comments +
          NL_NRt_NRtk_K.average_comments +
          NL_NRt_Rtk_NK.average_comments +
          NL_Rt_NRtk_NK.average_comments +
          L_NRt_NRtk_NK.average_comments +
          NL_NRt_Rtk_K.average_comments +
          NL_Rt_NRtk_K.average_comments +
          L_NRt_NRtk_K.average_comments +
          NL_Rt_Rtk_NK.average_comments +
          L_NRt_Rtk_NK.average_comments +
          L_Rt_NRtk_NK.average_comments +
          L_Rt_Rtk_NK.average_comments +
          NL_Rt_Rtk_K.average_comments +
          L_Rt_NRtk_K.average_comments +
          L_NRt_Rtk_K.average_comments +
          L_Rt_Rtk_K.average_comments
        ).toFixed(2)
      );

      const sumGspAverageOfAverage = (
        NL_NRt_NRtk_NK.averageOfAverage +
        NL_NRt_NRtk_K.averageOfAverage +
        NL_NRt_Rtk_NK.averageOfAverage +
        NL_Rt_NRtk_NK.averageOfAverage +
        L_NRt_NRtk_NK.averageOfAverage +
        NL_NRt_Rtk_K.averageOfAverage +
        NL_Rt_NRtk_K.averageOfAverage +
        L_NRt_NRtk_K.averageOfAverage +
        NL_Rt_Rtk_NK.averageOfAverage +
        L_NRt_Rtk_NK.averageOfAverage +
        L_Rt_NRtk_NK.averageOfAverage +
        L_Rt_Rtk_NK.averageOfAverage +
        NL_Rt_Rtk_K.averageOfAverage +
        L_Rt_NRtk_K.averageOfAverage +
        L_NRt_Rtk_K.averageOfAverage +
        L_Rt_Rtk_K.averageOfAverage
      ).toFixed(2);

      const sumGspMobEfetive =
        NL_NRt_NRtk_NK.mobEfetive +
        NL_NRt_NRtk_K.mobEfetive +
        NL_NRt_Rtk_NK.mobEfetive +
        NL_Rt_NRtk_NK.mobEfetive +
        L_NRt_NRtk_NK.mobEfetive +
        NL_NRt_Rtk_K.mobEfetive +
        NL_Rt_NRtk_K.mobEfetive +
        L_NRt_NRtk_K.mobEfetive +
        NL_Rt_Rtk_NK.mobEfetive +
        L_NRt_Rtk_NK.mobEfetive +
        L_Rt_NRtk_NK.mobEfetive +
        L_Rt_Rtk_NK.mobEfetive +
        NL_Rt_Rtk_K.mobEfetive +
        L_Rt_NRtk_K.mobEfetive +
        L_NRt_Rtk_K.mobEfetive +
        L_Rt_Rtk_K.mobEfetive;

      console.log("sumGspMobEfetive: ", sumGspMobEfetive);

      let collect = await this.collectionRepository.findOne({
        where: {
          id: collect_id,
        },
      });

      const followers_count = Number(collect.followers.replace(/\.|,/g, ""));

      const gspMobEfetiveByFreq = Number(sumGspMobEfetive) / sumGspFreq;
      console.log(sumGspMobEfetive, sumGspFreq);
      const gspMobEfetiveActiveUsers =
        Number(sumGspMobEfetive) * vCBSActiveUsers.vCBS;
      console.log(Number(sumGspMobEfetive), vCBSActiveUsers.vCBS);
      const gspMobEfetiveActiveUsersByInactiveUsers =
        gspMobEfetiveActiveUsers / vCBSInactiveUsers.vCBS;
      console.log(gspMobEfetiveActiveUsers, vCBSInactiveUsers.vCBS);

      // collect.totalTweets
      let sumCapitalSocialBourdiesian: number | string =
        gspMobEfetiveByFreq * gspMobEfetiveActiveUsersByInactiveUsers;

      console.log(
        gspMobEfetiveByFreq * gspMobEfetiveActiveUsersByInactiveUsers
      );

      const auxSumCapitalSocialBourdiesian = sumCapitalSocialBourdiesian
        .toExponential()
        .replace(/e\+?/, " x 10^")
        .split(" ");

      sumCapitalSocialBourdiesian = `${Number(
        auxSumCapitalSocialBourdiesian[0]
      ).toFixed(2)} ${auxSumCapitalSocialBourdiesian[1]} ${
        auxSumCapitalSocialBourdiesian[2]
      }`;

      console.log("---- vCSB -----");
      console.log("Mob Ef: ", sumGspMobEfetive);
      console.log("Interações Sociais: ", sumGspFreq);
      console.log("Usuarios Ativos: ", vCBSActiveUsers.vCBS);
      console.log("Usuarios Inativos: ", vCBSInactiveUsers.vCBS);
      console.log("Mob. Ef / Interações Sociais ", gspMobEfetiveByFreq);
      console.log("Mob. Ef * Usuários Ativos ", gspMobEfetiveActiveUsers);
      console.log(
        "Mob. Ef * Usuários Ativos / Usuários Inativos ",
        gspMobEfetiveActiveUsersByInactiveUsers
      );
      console.log(sumCapitalSocialBourdiesian);

      // Dados rotulados por Sentimento e Sequência GSP
      // Positive
      const positive_NL_NRt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt !Rtk !K",
          sentiment: "positive",
        });

      const positive_NL_NRt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt !Rtk K",
          sentiment: "positive",
        });

      const positive_NL_NRt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt Rtk !K",
          sentiment: "positive",
        });

      const positive_NL_Rt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt !Rtk !K",
          sentiment: "positive",
        });

      const positive_L_NRt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt !Rtk !K",
          sentiment: "positive",
        });

      const positive_NL_NRt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt Rtk K",
          sentiment: "positive",
        });

      const positive_NL_Rt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt !Rtk K",
          sentiment: "positive",
        });

      const positive_L_NRt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt !Rtk K",
          sentiment: "positive",
        });

      const positive_NL_Rt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt Rtk !K",
          sentiment: "positive",
        });

      const positive_L_NRt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt Rtk !K",
          sentiment: "positive",
        });

      const positive_L_Rt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt !Rtk !K",
          sentiment: "positive",
        });

      const positive_L_Rt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt Rtk !K",
          sentiment: "positive",
        });

      const positive_NL_Rt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt Rtk K",
          sentiment: "positive",
        });

      const positive_L_Rt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt !Rtk K",
          sentiment: "positive",
        });

      const positive_L_NRt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt Rtk K",
          sentiment: "positive",
        });

      const positive_L_Rt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt Rtk K",
          sentiment: "positive",
        });

      const sum_averageOfAverage_positive = (
        positive_NL_NRt_NRtk_NK.averageOfAverage +
        positive_NL_NRt_NRtk_K.averageOfAverage +
        positive_NL_NRt_Rtk_NK.averageOfAverage +
        positive_NL_Rt_NRtk_NK.averageOfAverage +
        positive_L_NRt_NRtk_NK.averageOfAverage +
        positive_NL_NRt_Rtk_K.averageOfAverage +
        positive_NL_Rt_NRtk_K.averageOfAverage +
        positive_L_NRt_NRtk_K.averageOfAverage +
        positive_NL_Rt_Rtk_NK.averageOfAverage +
        positive_L_NRt_Rtk_NK.averageOfAverage +
        positive_L_Rt_NRtk_NK.averageOfAverage +
        positive_L_Rt_Rtk_NK.averageOfAverage +
        positive_NL_Rt_Rtk_K.averageOfAverage +
        positive_L_Rt_NRtk_K.averageOfAverage +
        positive_L_NRt_Rtk_K.averageOfAverage +
        positive_L_Rt_Rtk_K.averageOfAverage
      ).toFixed(2);

      const sum_mobEfetive_positive = (
        positive_NL_NRt_NRtk_NK.mobEfetive +
        positive_NL_NRt_NRtk_K.mobEfetive +
        positive_NL_NRt_Rtk_NK.mobEfetive +
        positive_NL_Rt_NRtk_NK.mobEfetive +
        positive_L_NRt_NRtk_NK.mobEfetive +
        positive_NL_NRt_Rtk_K.mobEfetive +
        positive_NL_Rt_NRtk_K.mobEfetive +
        positive_L_NRt_NRtk_K.mobEfetive +
        positive_NL_Rt_Rtk_NK.mobEfetive +
        positive_L_NRt_Rtk_NK.mobEfetive +
        positive_L_Rt_NRtk_NK.mobEfetive +
        positive_L_Rt_Rtk_NK.mobEfetive +
        positive_NL_Rt_Rtk_K.mobEfetive +
        positive_L_Rt_NRtk_K.mobEfetive +
        positive_L_NRt_Rtk_K.mobEfetive +
        positive_L_Rt_Rtk_K.mobEfetive
      ).toFixed(2);

      console.log("sum_mobEfetive_positive: ", sum_mobEfetive_positive);

      const positiveMobEfetiveByFreq =
        Number(sum_mobEfetive_positive) / sumGspFreq;
      const positiveMobEfetiveActiveUsers =
        Number(sum_mobEfetive_positive) * vCBSActiveUsers.vCBSPositive;
      const positiveMobEfetiveActiveUsersByInactiveUsers =
        positiveMobEfetiveActiveUsers / vCBSInactiveUsers.vCBSPositive;

      let sumCapitalSocialBourdiesianPositive: number | string =
        positiveMobEfetiveByFreq * positiveMobEfetiveActiveUsersByInactiveUsers;

      console.log(
        positiveMobEfetiveByFreq * positiveMobEfetiveActiveUsersByInactiveUsers
      );

      const auxSumCapitalSocialBourdiesianPositive =
        sumCapitalSocialBourdiesianPositive
          .toExponential()
          .replace(/e\+?/, " x 10^")
          .split(" ");

      sumCapitalSocialBourdiesianPositive = `${Number(
        auxSumCapitalSocialBourdiesianPositive[0]
      ).toFixed(2)} ${auxSumCapitalSocialBourdiesianPositive[1]} ${
        auxSumCapitalSocialBourdiesianPositive[2]
      }`;

      console.log("---- vCSB Positive -----");
      console.log("Mob Ef: ", sum_mobEfetive_positive);
      console.log("Interações Sociais: ", sumGspFreq);
      console.log("Usuarios Ativos: ", vCBSActiveUsers.vCBSPositive);
      console.log("Usuarios Inativos: ", vCBSInactiveUsers.vCBSPositive);
      console.log(
        "Mob. Ef Sentimento positivo/ Interações Sociais ",
        positiveMobEfetiveByFreq
      );
      console.log(
        "Mob. Ef Sentimento positivo * Usuários Ativos ",
        positiveMobEfetiveActiveUsers
      );
      console.log(
        "Mob. Ef Sentimento positivo * Usuários Ativos / Usuários Inativos ",
        positiveMobEfetiveActiveUsersByInactiveUsers
      );
      console.log(sumCapitalSocialBourdiesianPositive);

      //Neutral
      const neutral_NL_NRt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt !Rtk !K",
          sentiment: "neutral",
        });

      const neutral_NL_NRt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt !Rtk K",
          sentiment: "neutral",
        });

      const neutral_NL_NRt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt Rtk !K",
          sentiment: "neutral",
        });

      const neutral_NL_Rt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt !Rtk !K",
          sentiment: "neutral",
        });

      const neutral_L_NRt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt !Rtk !K",
          sentiment: "neutral",
        });

      const neutral_NL_NRt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt Rtk K",
          sentiment: "neutral",
        });

      const neutral_NL_Rt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt !Rtk K",
          sentiment: "neutral",
        });

      const neutral_L_NRt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt !Rtk K",
          sentiment: "neutral",
        });

      const neutral_NL_Rt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt Rtk !K",
          sentiment: "neutral",
        });

      const neutral_L_NRt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt Rtk !K",
          sentiment: "neutral",
        });

      const neutral_L_Rt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt !Rtk !K",
          sentiment: "neutral",
        });

      const neutral_L_Rt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt Rtk !K",
          sentiment: "neutral",
        });

      const neutral_NL_Rt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt Rtk K",
          sentiment: "neutral",
        });

      const neutral_L_Rt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt !Rtk K",
          sentiment: "neutral",
        });

      const neutral_L_NRt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt Rtk K",
          sentiment: "neutral",
        });

      const neutral_L_Rt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt Rtk K",
          sentiment: "neutral",
        });

      const sum_averageOfAverage_neutral = (
        neutral_NL_NRt_NRtk_NK.averageOfAverage +
        neutral_NL_NRt_NRtk_K.averageOfAverage +
        neutral_NL_NRt_Rtk_NK.averageOfAverage +
        neutral_NL_Rt_NRtk_NK.averageOfAverage +
        neutral_L_NRt_NRtk_NK.averageOfAverage +
        neutral_NL_NRt_Rtk_K.averageOfAverage +
        neutral_NL_Rt_NRtk_K.averageOfAverage +
        neutral_L_NRt_NRtk_K.averageOfAverage +
        neutral_NL_Rt_Rtk_NK.averageOfAverage +
        neutral_L_NRt_Rtk_NK.averageOfAverage +
        neutral_L_Rt_NRtk_NK.averageOfAverage +
        neutral_L_Rt_Rtk_NK.averageOfAverage +
        neutral_NL_Rt_Rtk_K.averageOfAverage +
        neutral_L_Rt_NRtk_K.averageOfAverage +
        neutral_L_NRt_Rtk_K.averageOfAverage +
        neutral_L_Rt_Rtk_K.averageOfAverage
      ).toFixed(2);

      const sum_mobEfetive_neutral = (
        neutral_NL_NRt_NRtk_NK.mobEfetive +
        neutral_NL_NRt_NRtk_K.mobEfetive +
        neutral_NL_NRt_Rtk_NK.mobEfetive +
        neutral_NL_Rt_NRtk_NK.mobEfetive +
        neutral_L_NRt_NRtk_NK.mobEfetive +
        neutral_NL_NRt_Rtk_K.mobEfetive +
        neutral_NL_Rt_NRtk_K.mobEfetive +
        neutral_L_NRt_NRtk_K.mobEfetive +
        neutral_NL_Rt_Rtk_NK.mobEfetive +
        neutral_L_NRt_Rtk_NK.mobEfetive +
        neutral_L_Rt_NRtk_NK.mobEfetive +
        neutral_L_Rt_Rtk_NK.mobEfetive +
        neutral_NL_Rt_Rtk_K.mobEfetive +
        neutral_L_Rt_NRtk_K.mobEfetive +
        neutral_L_NRt_Rtk_K.mobEfetive +
        neutral_L_Rt_Rtk_K.mobEfetive
      ).toFixed(2);

      console.log("sum_mobEfetive_neutral: ", sum_mobEfetive_neutral);

      const neutralMobEfetiveByFreq =
        Number(sum_mobEfetive_neutral) / sumGspFreq;
      const neutralMobEfetiveActiveUsers =
        Number(sum_mobEfetive_neutral) * vCBSActiveUsers.vCBSNeutral;
      const neutralMobEfetiveActiveUsersByInactiveUsers =
        neutralMobEfetiveActiveUsers / vCBSInactiveUsers.vCBSNeutral;

      let sumCapitalSocialBourdiesianNeutral: number | string =
        neutralMobEfetiveByFreq * neutralMobEfetiveActiveUsersByInactiveUsers;

      console.log(
        neutralMobEfetiveByFreq * neutralMobEfetiveActiveUsersByInactiveUsers
      );

      const auxSumCapitalSocialBourdiesianNeutral =
        sumCapitalSocialBourdiesianNeutral
          .toExponential()
          .replace(/e\+?/, " x 10^")
          .split(" ");

      sumCapitalSocialBourdiesianNeutral = `${Number(
        auxSumCapitalSocialBourdiesianNeutral[0]
      ).toFixed(2)} ${auxSumCapitalSocialBourdiesianNeutral[1]} ${
        auxSumCapitalSocialBourdiesianNeutral[2]
      }`;

      console.log("---- vCSB Neutral -----");
      console.log("Mob Ef: ", sum_mobEfetive_neutral);
      console.log("Interações Sociais: ", sumGspFreq);
      console.log("Usuarios Ativos: ", vCBSActiveUsers.vCBSNeutral);
      console.log("Usuarios Inativos: ", vCBSInactiveUsers.vCBSNeutral);
      console.log(
        "Mob. Ef Sentimento neutral/ Interações Sociais ",
        neutralMobEfetiveByFreq
      );
      console.log(
        "Mob. Ef Sentimento neutral * Usuários Ativos ",
        neutralMobEfetiveActiveUsers
      );
      console.log(
        "Mob. Ef Sentimento neutral * Usuários Ativos / Usuários Inativos ",
        neutralMobEfetiveActiveUsersByInactiveUsers
      );
      console.log(sumCapitalSocialBourdiesianNeutral);

      //Negative
      const negative_NL_NRt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt !Rtk !K",
          sentiment: "negative",
        });

      const negative_NL_NRt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt !Rtk K",
          sentiment: "negative",
        });

      const negative_NL_NRt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt Rtk !K",
          sentiment: "negative",
        });

      const negative_NL_Rt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt !Rtk !K",
          sentiment: "negative",
        });

      const negative_L_NRt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt !Rtk !K",
          sentiment: "negative",
        });

      const negative_NL_NRt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt Rtk K",
          sentiment: "negative",
        });

      const negative_NL_Rt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt !Rtk K",
          sentiment: "negative",
        });

      const negative_L_NRt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt !Rtk K",
          sentiment: "negative",
        });

      const negative_NL_Rt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt Rtk !K",
          sentiment: "negative",
        });

      const negative_L_NRt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt Rtk !K",
          sentiment: "negative",
        });

      const negative_L_Rt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt !Rtk !K",
          sentiment: "negative",
        });

      const negative_L_Rt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt Rtk !K",
          sentiment: "negative",
        });

      const negative_NL_Rt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt Rtk K",
          sentiment: "negative",
        });

      const negative_L_Rt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt !Rtk K",
          sentiment: "negative",
        });

      const negative_L_NRt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt Rtk K",
          sentiment: "negative",
        });

      const negative_L_Rt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt Rtk K",
          sentiment: "negative",
        });

      //Unclassified
      const unclassified_NL_NRt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt !Rtk !K",
          sentiment: "não classificado",
        });

      const unclassified_NL_NRt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt !Rtk K",
          sentiment: "não classificado",
        });

      const unclassified_NL_NRt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt Rtk !K",
          sentiment: "não classificado",
        });

      const unclassified_NL_Rt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt !Rtk !K",
          sentiment: "não classificado",
        });

      const unclassified_L_NRt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt !Rtk !K",
          sentiment: "não classificado",
        });

      const unclassified_NL_NRt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L !Rt Rtk K",
          sentiment: "não classificado",
        });

      const unclassified_NL_Rt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt !Rtk K",
          sentiment: "não classificado",
        });

      const unclassified_L_NRt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt !Rtk K",
          sentiment: "não classificado",
        });

      const unclassified_NL_Rt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt Rtk !K",
          sentiment: "não classificado",
        });

      const unclassified_L_NRt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt Rtk !K",
          sentiment: "não classificado",
        });

      const unclassified_L_Rt_NRtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt !Rtk !K",
          sentiment: "não classificado",
        });

      const unclassified_L_Rt_Rtk_NK =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt Rtk !K",
          sentiment: "não classificado",
        });

      const unclassified_NL_Rt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "!L Rt Rtk K",
          sentiment: "não classificado",
        });

      const unclassified_L_Rt_NRtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt !Rtk K",
          sentiment: "não classificado",
        });

      const unclassified_L_NRt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L !Rt Rtk K",
          sentiment: "não classificado",
        });

      const unclassified_L_Rt_Rtk_K =
        await this.get_gsp_collect_with_sentiment_report({
          collect_id,
          gspSequence: "L Rt Rtk K",
          sentiment: "não classificado",
        });

      const report_template = path.resolve(
        __dirname,
        "..",
        "..",
        "storage",
        "template",
        "relatorio.hbs"
      );

      const report_result_html = path.resolve(
        __dirname,
        "..",
        "..",
        "storage",
        "reports",
        `${collect_id}-${uuidv4()}report.html`
      );

      const report_result_docx = path.resolve(
        __dirname,
        "..",
        "..",
        "storage",
        "reports",
        `${collect_id}-${uuidv4()}report.odt`
      );

      const report_result_pdf = path.resolve(
        __dirname,
        "..",
        "..",
        "storage",
        "reports",
        `${collect_id}-${uuidv4()}report.pdf`
      );

      const html = fs.readFileSync(report_template, "utf-8");

      const sumAverageLikes = format_number_pt_br(
        positive_report.average_likes +
          neutral_report.average_likes +
          negative_report.average_likes +
          unclassified_report.average_likes
      );

      const sumAverageRetweets = format_number_pt_br(
        positive_report.average_retweets +
          neutral_report.average_retweets +
          negative_report.average_retweets +
          unclassified_report.average_retweets
      );

      const sumAverageRetweetsWithComments = format_number_pt_br(
        positive_report.average_retweets_with_comments +
          neutral_report.average_retweets_with_comments +
          negative_report.average_retweets_with_comments +
          unclassified_report.average_retweets_with_comments
      );

      const sumAverageComments = format_number_pt_br(
        positive_report.average_comments +
          neutral_report.average_comments +
          negative_report.average_comments +
          unclassified_report.average_comments
      );

      const sum_averageOfAverage_negative = (
        negative_NL_NRt_NRtk_NK.averageOfAverage +
        negative_NL_NRt_NRtk_K.averageOfAverage +
        negative_NL_NRt_Rtk_NK.averageOfAverage +
        negative_NL_Rt_NRtk_NK.averageOfAverage +
        negative_L_NRt_NRtk_NK.averageOfAverage +
        negative_NL_NRt_Rtk_K.averageOfAverage +
        negative_NL_Rt_NRtk_K.averageOfAverage +
        negative_L_NRt_NRtk_K.averageOfAverage +
        negative_NL_Rt_Rtk_NK.averageOfAverage +
        negative_L_NRt_Rtk_NK.averageOfAverage +
        negative_L_Rt_NRtk_NK.averageOfAverage +
        negative_L_Rt_Rtk_NK.averageOfAverage +
        negative_NL_Rt_Rtk_K.averageOfAverage +
        negative_L_Rt_NRtk_K.averageOfAverage +
        negative_L_NRt_Rtk_K.averageOfAverage +
        negative_L_Rt_Rtk_K.averageOfAverage
      ).toFixed(2);

      const sum_mobEfetive_negative = (
        negative_NL_NRt_NRtk_NK.mobEfetive +
        negative_NL_NRt_NRtk_K.mobEfetive +
        negative_NL_NRt_Rtk_NK.mobEfetive +
        negative_NL_Rt_NRtk_NK.mobEfetive +
        negative_L_NRt_NRtk_NK.mobEfetive +
        negative_NL_NRt_Rtk_K.mobEfetive +
        negative_NL_Rt_NRtk_K.mobEfetive +
        negative_L_NRt_NRtk_K.mobEfetive +
        negative_NL_Rt_Rtk_NK.mobEfetive +
        negative_L_NRt_Rtk_NK.mobEfetive +
        negative_L_Rt_NRtk_NK.mobEfetive +
        negative_L_Rt_Rtk_NK.mobEfetive +
        negative_NL_Rt_Rtk_K.mobEfetive +
        negative_L_Rt_NRtk_K.mobEfetive +
        negative_L_NRt_Rtk_K.mobEfetive +
        negative_L_Rt_Rtk_K.mobEfetive
      ).toFixed(2);

      console.log("sum_mobEfetive_negative: ", sum_mobEfetive_negative);

      const sum_averageOfAverage_unclassified = (
        unclassified_NL_NRt_NRtk_NK.averageOfAverage +
        unclassified_NL_NRt_NRtk_K.averageOfAverage +
        unclassified_NL_NRt_Rtk_NK.averageOfAverage +
        unclassified_NL_Rt_NRtk_NK.averageOfAverage +
        unclassified_L_NRt_NRtk_NK.averageOfAverage +
        unclassified_NL_NRt_Rtk_K.averageOfAverage +
        unclassified_NL_Rt_NRtk_K.averageOfAverage +
        unclassified_L_NRt_NRtk_K.averageOfAverage +
        unclassified_NL_Rt_Rtk_NK.averageOfAverage +
        unclassified_L_NRt_Rtk_NK.averageOfAverage +
        unclassified_L_Rt_NRtk_NK.averageOfAverage +
        unclassified_L_Rt_Rtk_NK.averageOfAverage +
        unclassified_NL_Rt_Rtk_K.averageOfAverage +
        unclassified_L_Rt_NRtk_K.averageOfAverage +
        unclassified_L_NRt_Rtk_K.averageOfAverage +
        unclassified_L_Rt_Rtk_K.averageOfAverage
      ).toFixed(2);

      const sum_mobEfetive_unclassified = (
        unclassified_NL_NRt_NRtk_NK.mobEfetive +
        unclassified_NL_NRt_NRtk_K.mobEfetive +
        unclassified_NL_NRt_Rtk_NK.mobEfetive +
        unclassified_NL_Rt_NRtk_NK.mobEfetive +
        unclassified_L_NRt_NRtk_NK.mobEfetive +
        unclassified_NL_NRt_Rtk_K.mobEfetive +
        unclassified_NL_Rt_NRtk_K.mobEfetive +
        unclassified_L_NRt_NRtk_K.mobEfetive +
        unclassified_NL_Rt_Rtk_NK.mobEfetive +
        unclassified_L_NRt_Rtk_NK.mobEfetive +
        unclassified_L_Rt_NRtk_NK.mobEfetive +
        unclassified_L_Rt_Rtk_NK.mobEfetive +
        unclassified_NL_Rt_Rtk_K.mobEfetive +
        unclassified_L_Rt_NRtk_K.mobEfetive +
        unclassified_L_NRt_Rtk_K.mobEfetive +
        unclassified_L_Rt_Rtk_K.mobEfetive
      ).toFixed(2);

      console.log("sum_mobEfetive_unclassified: ", sum_mobEfetive_unclassified);

      const negativeMobEfetiveByFreq =
        Number(sum_mobEfetive_negative) / sumGspFreq;
      const negativeMobEfetiveActiveUsers =
        Number(sum_mobEfetive_negative) * vCBSActiveUsers.vCBSNegative;
      const negativeMobEfetiveActiveUsersByInactiveUsers =
        negativeMobEfetiveActiveUsers / vCBSInactiveUsers.vCBSNegative;

      let sumCapitalSocialBourdiesianNegative: number | string =
        negativeMobEfetiveByFreq * negativeMobEfetiveActiveUsersByInactiveUsers;

      console.log(
        negativeMobEfetiveByFreq * negativeMobEfetiveActiveUsersByInactiveUsers
      );

      const auxSumCapitalSocialBourdiesianNegative =
        sumCapitalSocialBourdiesianNegative
          .toExponential()
          .replace(/e\+?/, " x 10^")
          .split(" ");

      sumCapitalSocialBourdiesianNegative = `${Number(
        auxSumCapitalSocialBourdiesianNegative[0]
      ).toFixed(2)} ${auxSumCapitalSocialBourdiesianNegative[1]} ${
        auxSumCapitalSocialBourdiesianNegative[2]
      }`;

      console.log("---- vCSB Negative -----");
      console.log("Mob Ef: ", sum_mobEfetive_negative);
      console.log("Interações Sociais: ", sumGspFreq);
      console.log("Usuarios Ativos: ", vCBSActiveUsers.vCBSNegative);
      console.log("Usuarios Inativos: ", vCBSInactiveUsers.vCBSNegative);
      console.log(
        "Mob. Ef Sentimento negativo/ Interações Sociais ",
        negativeMobEfetiveByFreq
      );
      console.log(
        "Mob. Ef Sentimento negativo * Usuários Ativos ",
        negativeMobEfetiveActiveUsers
      );
      console.log(
        "Mob. Ef Sentimento negativo * Usuários Ativos / Usuários Inativos ",
        negativeMobEfetiveActiveUsersByInactiveUsers
      );
      console.log(sumCapitalSocialBourdiesianNegative);

      const unclassifiedMobEfetiveByFreq =
        Number(sum_mobEfetive_unclassified) / sumGspFreq;
      const unclassifiedMobEfetiveActiveUsers =
        Number(sum_mobEfetive_unclassified) * vCBSActiveUsers.vCBSNClass;
      const unclassifiedMobEfetiveActiveUsersByInactiveUsers =
        unclassifiedMobEfetiveActiveUsers / vCBSInactiveUsers.vCBSNClass;

      let sumCapitalSocialBourdiesianNonClass: number | string =
        unclassifiedMobEfetiveByFreq *
        unclassifiedMobEfetiveActiveUsersByInactiveUsers;

      console.log(
        unclassifiedMobEfetiveByFreq *
          unclassifiedMobEfetiveActiveUsersByInactiveUsers
      );

      const auxSumCapitalSocialBourdiesianNonClass =
        sumCapitalSocialBourdiesianNonClass
          .toExponential()
          .replace(/e\+?/, " x 10^")
          .split(" ");

      sumCapitalSocialBourdiesianNonClass = `${Number(
        auxSumCapitalSocialBourdiesianNonClass[0]
      ).toFixed(2)} ${auxSumCapitalSocialBourdiesianNonClass[1]} ${
        auxSumCapitalSocialBourdiesianNonClass[2]
      }`;

      console.log("---- vCSB Nclass -----");
      console.log("Mob Ef: ", sum_mobEfetive_unclassified);
      console.log("Interações Sociais: ", sumGspFreq);
      console.log("Usuarios Ativos: ", vCBSActiveUsers.vCBSNClass);
      console.log("Usuarios Inativos: ", vCBSInactiveUsers.vCBSNClass);
      console.log(
        "Mob. Ef Sentimento não class/ Interações Sociais ",
        unclassifiedMobEfetiveByFreq
      );
      console.log(
        "Mob. Ef Sentimento não class * Usuários Ativos ",
        unclassifiedMobEfetiveActiveUsers
      );
      console.log(
        "Mob. Ef Sentimento não class * Usuários Ativos / Usuários Inativos ",
        unclassifiedMobEfetiveActiveUsersByInactiveUsers
      );
      console.log(sumCapitalSocialBourdiesianNonClass);

      const content = hbs.compile(html)({
        numberOfTweets: collect.totalTweets,
        numberOfFollowers: collect.followers,
        positiveFreq: format_number_pt_br(positive_report.freq),
        positiveAverageLikes: format_number_pt_br(
          positive_report.average_likes
        ),
        positiveAverageRetweets: format_number_pt_br(
          positive_report.average_retweets
        ),
        positiveAverageRetweetsWithComments: format_number_pt_br(
          positive_report.average_retweets_with_comments
        ),
        positiveAverageComments: format_number_pt_br(
          positive_report.average_comments
        ),
        neutralFreq: format_number_pt_br(neutral_report.freq),
        neutralAverageLikes: format_number_pt_br(neutral_report.average_likes),
        neutralAverageRetweets: format_number_pt_br(
          neutral_report.average_retweets
        ),
        neutralAverageRetweetsWithComments: format_number_pt_br(
          neutral_report.average_retweets_with_comments
        ),
        neutralAverageComments: format_number_pt_br(
          neutral_report.average_comments
        ),
        negativeFreq: format_number_pt_br(negative_report.freq),
        negativeAverageLikes: format_number_pt_br(
          negative_report.average_likes
        ),
        negativeAverageRetweets: format_number_pt_br(
          negative_report.average_retweets
        ),
        negativeAverageRetweetsWithComments: format_number_pt_br(
          negative_report.average_retweets_with_comments
        ),
        negativeAverageComments: format_number_pt_br(
          negative_report.average_comments
        ),
        unclassifiedFreq: format_number_pt_br(unclassified_report.freq),
        unclassifiedAverageLikes: format_number_pt_br(
          unclassified_report.average_likes
        ),
        unclassifiedAverageRetweets: format_number_pt_br(
          unclassified_report.average_retweets
        ),
        unclassifiedAverageRetweetsWithComments: format_number_pt_br(
          unclassified_report.average_retweets_with_comments
        ),
        unclassifiedAverageComments: format_number_pt_br(
          unclassified_report.average_comments
        ),
        sumFreq: format_number_pt_br(
          positive_report.freq +
            neutral_report.freq +
            negative_report.freq +
            unclassified_report.freq
        ),
        sumAverageLikes,
        sumAverageRetweets,
        sumAverageRetweetsWithComments,
        sumAverageComments,
        sumFreqNL_NRt_NRtk_NK: format_number_pt_br(NL_NRt_NRtk_NK.freq),
        sumAverageLikesNL_NRt_NRtk_NK: format_number_pt_br(
          NL_NRt_NRtk_NK.average_likes
        ),
        sumMaxLikesNL_NRt_NRtk_NK: NL_NRt_NRtk_NK_max_value.maxLikes,
        sumAverageRetweetsNL_NRt_NRtk_NK: format_number_pt_br(
          NL_NRt_NRtk_NK.average_retweets
        ),
        sumMaxRetweetsNL_NRt_NRtk_NK: NL_NRt_NRtk_NK_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsNL_NRt_NRtk_NK: format_number_pt_br(
          NL_NRt_NRtk_NK.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsNL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_max_value.maxRetweetsWithComments,
        sumAverageCommentsNL_NRt_NRtk_NK: format_number_pt_br(
          NL_NRt_NRtk_NK.average_comments
        ),
        sumMaxCommentsNL_NRt_NRtk_NK: NL_NRt_NRtk_NK_max_value.maxComments,
        mobEfetiveNL_NRt_NRtk_NK: format_number_pt_br(
          NL_NRt_NRtk_NK.mobEfetive
        ),
        sumFreqNL_NRt_NRtk_K: format_number_pt_br(NL_NRt_NRtk_K.freq),
        sumAverageLikesNL_NRt_NRtk_K: format_number_pt_br(
          NL_NRt_NRtk_K.average_likes
        ),
        sumMaxLikesNL_NRt_NRtk_K: NL_NRt_NRtk_K_max_value.maxLikes,
        sumAverageRetweetsNL_NRt_NRtk_K: format_number_pt_br(
          NL_NRt_NRtk_K.average_retweets
        ),
        sumMaxRetweetsNL_NRt_NRtk_K: NL_NRt_NRtk_K_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsNL_NRt_NRtk_K: format_number_pt_br(
          NL_NRt_NRtk_K.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsNL_NRt_NRtk_K:
          NL_NRt_NRtk_K_max_value.maxRetweetsWithComments,
        sumAverageCommentsNL_NRt_NRtk_K: format_number_pt_br(
          NL_NRt_NRtk_K.average_comments
        ),
        sumMaxCommentsNL_NRt_NRtk_K: NL_NRt_NRtk_K_max_value.maxComments,
        mobEfetiveNL_NRt_NRtk_K: format_number_pt_br(NL_NRt_NRtk_K.mobEfetive),
        sumFreqNL_NRt_Rtk_NK: format_number_pt_br(NL_NRt_Rtk_NK.freq),
        sumAverageLikesNL_NRt_Rtk_NK: format_number_pt_br(
          NL_NRt_Rtk_NK.average_likes
        ),
        sumMaxLikesNL_NRt_Rtk_NK: NL_NRt_Rtk_NK_max_value.maxLikes,
        sumAverageRetweetsNL_NRt_Rtk_NK: format_number_pt_br(
          NL_NRt_Rtk_NK.average_retweets
        ),
        sumMaxRetweetsNL_NRt_Rtk_NK: NL_NRt_Rtk_NK_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsNL_NRt_Rtk_NK: format_number_pt_br(
          NL_NRt_Rtk_NK.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsNL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_max_value.maxRetweetsWithComments,
        sumAverageCommentsNL_NRt_Rtk_NK: format_number_pt_br(
          NL_NRt_Rtk_NK.average_comments
        ),
        sumMaxCommentsNL_NRt_Rtk_NK: NL_NRt_Rtk_NK_max_value.maxComments,
        mobEfetiveNL_NRt_Rtk_NK: format_number_pt_br(NL_NRt_Rtk_NK.mobEfetive),
        sumFreqNL_Rt_NRtk_NK: format_number_pt_br(NL_Rt_NRtk_NK.freq),
        sumAverageLikesNL_Rt_NRtk_NK: format_number_pt_br(
          NL_Rt_NRtk_NK.average_likes
        ),
        sumMaxLikesNL_Rt_NRtk_NK: NL_Rt_NRtk_NK_max_value.maxLikes,
        sumAverageRetweetsNL_Rt_NRtk_NK: format_number_pt_br(
          NL_Rt_NRtk_NK.average_retweets
        ),
        sumMaxRetweetsNL_Rt_NRtk_NK: NL_Rt_NRtk_NK_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsNL_Rt_NRtk_NK: format_number_pt_br(
          NL_Rt_NRtk_NK.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsNL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_max_value.maxRetweetsWithComments,
        sumAverageCommentsNL_Rt_NRtk_NK: format_number_pt_br(
          NL_Rt_NRtk_NK.average_comments
        ),
        sumMaxCommentsNL_Rt_NRtk_NK: NL_Rt_NRtk_NK_max_value.maxComments,
        mobEfetiveNL_Rt_NRtk_NK: format_number_pt_br(NL_Rt_NRtk_NK.mobEfetive),
        sumFreqL_NRt_NRtk_NK: format_number_pt_br(L_NRt_NRtk_NK.freq),
        sumAverageLikesL_NRt_NRtk_NK: format_number_pt_br(
          L_NRt_NRtk_NK.average_likes
        ),
        sumMaxLikesL_NRt_NRtk_NK: L_NRt_NRtk_NK_max_value.maxLikes,
        sumAverageRetweetsL_NRt_NRtk_NK: format_number_pt_br(
          L_NRt_NRtk_NK.average_retweets
        ),
        sumMaxRetweetsL_NRt_NRtk_NK: L_NRt_NRtk_NK_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsL_NRt_NRtk_NK: format_number_pt_br(
          L_NRt_NRtk_NK.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsL_NRt_NRtk_NK:
          L_NRt_NRtk_NK_max_value.maxRetweetsWithComments,
        sumAverageCommentsL_NRt_NRtk_NK: format_number_pt_br(
          L_NRt_NRtk_NK.average_comments
        ),
        sumMaxCommentsL_NRt_NRtk_NK: L_NRt_NRtk_NK_max_value.maxComments,
        mobEfetiveL_NRt_NRtk_NK: format_number_pt_br(L_NRt_NRtk_NK.mobEfetive),
        sumFreqNL_NRt_Rtk_K: format_number_pt_br(NL_NRt_Rtk_K.freq),
        sumAverageLikesNL_NRt_Rtk_K: format_number_pt_br(
          NL_NRt_Rtk_K.average_likes
        ),
        sumMaxLikesNL_NRt_Rtk_K: NL_NRt_Rtk_K_max_value.maxLikes,
        sumAverageRetweetsNL_NRt_Rtk_K: format_number_pt_br(
          NL_NRt_Rtk_K.average_retweets
        ),
        sumMaxRetweetsNL_NRt_Rtk_K: NL_NRt_Rtk_K_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsNL_NRt_Rtk_K: format_number_pt_br(
          NL_NRt_Rtk_K.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsNL_NRt_Rtk_K:
          NL_NRt_Rtk_K_max_value.maxRetweetsWithComments,
        sumAverageCommentsNL_NRt_Rtk_K: format_number_pt_br(
          NL_NRt_Rtk_K.average_comments
        ),
        sumMaxCommentsNL_NRt_Rtk_K: NL_NRt_Rtk_K_max_value.maxComments,
        mobEfetiveNL_NRt_Rtk_K: format_number_pt_br(NL_NRt_Rtk_K.mobEfetive),
        sumFreqNL_Rt_NRtk_K: format_number_pt_br(NL_Rt_NRtk_K.freq),
        sumAverageLikesNL_Rt_NRtk_K: format_number_pt_br(
          NL_Rt_NRtk_K.average_likes
        ),
        sumMaxLikesNL_Rt_NRtk_K: NL_Rt_NRtk_K_max_value.maxLikes,
        sumAverageRetweetsNL_Rt_NRtk_K: format_number_pt_br(
          NL_Rt_NRtk_K.average_retweets
        ),
        sumMaxRetweetsNL_Rt_NRtk_K: NL_Rt_NRtk_K_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsNL_Rt_NRtk_K: format_number_pt_br(
          NL_Rt_NRtk_K.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsNL_Rt_NRtk_K:
          NL_Rt_NRtk_K_max_value.maxRetweetsWithComments,
        sumAverageCommentsNL_Rt_NRtk_K: format_number_pt_br(
          NL_Rt_NRtk_K.average_comments
        ),
        sumMaxCommentsNL_Rt_NRtk_K: NL_Rt_NRtk_K_max_value.maxComments,
        mobEfetiveNL_Rt_NRtk_K: format_number_pt_br(NL_Rt_NRtk_K.mobEfetive),
        sumFreqL_NRt_NRtk_K: format_number_pt_br(L_NRt_NRtk_K.freq),
        sumAverageLikesL_NRt_NRtk_K: format_number_pt_br(
          L_NRt_NRtk_K.average_likes
        ),
        sumMaxLikesL_NRt_NRtk_K: L_NRt_NRtk_K_max_value.maxLikes,
        sumAverageRetweetsL_NRt_NRtk_K: format_number_pt_br(
          L_NRt_NRtk_K.average_retweets
        ),
        sumMaxRetweetsL_NRt_NRtk_K: L_NRt_NRtk_K_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsL_NRt_NRtk_K: format_number_pt_br(
          L_NRt_NRtk_K.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsL_NRt_NRtk_K:
          L_NRt_NRtk_K_max_value.maxRetweetsWithComments,
        sumAverageCommentsL_NRt_NRtk_K: format_number_pt_br(
          L_NRt_NRtk_K.average_comments
        ),
        sumMaxCommentsL_NRt_NRtk_K: L_NRt_NRtk_K_max_value.maxComments,
        mobEfetiveL_NRt_NRtk_K: format_number_pt_br(L_NRt_NRtk_K.mobEfetive),
        sumFreqNL_Rt_Rtk_NK: format_number_pt_br(NL_Rt_Rtk_NK.freq),
        sumAverageLikesNL_Rt_Rtk_NK: format_number_pt_br(
          NL_Rt_Rtk_NK.average_likes
        ),
        sumMaxLikesNL_Rt_Rtk_NK: NL_Rt_Rtk_NK_max_value.maxLikes,
        sumAverageRetweetsNL_Rt_Rtk_NK: format_number_pt_br(
          NL_Rt_Rtk_NK.average_retweets
        ),
        sumMaxRetweetsNL_Rt_Rtk_NK: NL_Rt_Rtk_NK_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsNL_Rt_Rtk_NK: format_number_pt_br(
          NL_Rt_Rtk_NK.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsNL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_max_value.maxRetweetsWithComments,
        sumAverageCommentsNL_Rt_Rtk_NK: format_number_pt_br(
          NL_Rt_Rtk_NK.average_comments
        ),
        sumMaxCommentsNL_Rt_Rtk_NK: NL_Rt_Rtk_NK_max_value.maxComments,
        mobEfetiveNL_Rt_Rtk_NK: format_number_pt_br(NL_Rt_Rtk_NK.mobEfetive),
        sumFreqL_NRt_Rtk_NK: format_number_pt_br(L_NRt_Rtk_NK.freq),
        sumAverageLikesL_NRt_Rtk_NK: format_number_pt_br(
          L_NRt_Rtk_NK.average_likes
        ),
        sumMaxLikesL_NRt_Rtk_NK: L_NRt_Rtk_NK_max_value.maxLikes,
        sumAverageRetweetsL_NRt_Rtk_NK: format_number_pt_br(
          L_NRt_Rtk_NK.average_retweets
        ),
        sumMaxRetweetsL_NRt_Rtk_NK: L_NRt_Rtk_NK_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsL_NRt_Rtk_NK: format_number_pt_br(
          L_NRt_Rtk_NK.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsL_NRt_Rtk_NK:
          L_NRt_Rtk_NK_max_value.maxRetweetsWithComments,
        sumAverageCommentsL_NRt_Rtk_NK: format_number_pt_br(
          L_NRt_Rtk_NK.average_comments
        ),
        sumMaxCommentsL_NRt_Rtk_NK: L_NRt_Rtk_NK_max_value.maxComments,
        mobEfetiveL_NRt_Rtk_NK: format_number_pt_br(L_NRt_Rtk_NK.mobEfetive),
        sumFreqL_Rt_NRtk_NK: format_number_pt_br(L_Rt_NRtk_NK.freq),
        sumAverageLikesL_Rt_NRtk_NK: format_number_pt_br(
          L_Rt_NRtk_NK.average_likes
        ),
        sumMaxLikesL_Rt_NRtk_NK: L_Rt_NRtk_NK_max_value.maxLikes,
        sumAverageRetweetsL_Rt_NRtk_NK: format_number_pt_br(
          L_Rt_NRtk_NK.average_retweets
        ),
        sumMaxRetweetsL_Rt_NRtk_NK: L_Rt_NRtk_NK_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsL_Rt_NRtk_NK: format_number_pt_br(
          L_Rt_NRtk_NK.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsL_Rt_NRtk_NK:
          L_Rt_NRtk_NK_max_value.maxRetweetsWithComments,
        sumAverageCommentsL_Rt_NRtk_NK: format_number_pt_br(
          L_Rt_NRtk_NK.average_comments
        ),
        sumMaxCommentsL_Rt_NRtk_NK: L_Rt_NRtk_NK_max_value.maxComments,
        mobEfetiveL_Rt_NRtk_NK: format_number_pt_br(L_Rt_NRtk_NK.mobEfetive),
        sumFreqL_Rt_Rtk_NK: format_number_pt_br(L_Rt_Rtk_NK.freq),
        sumAverageLikesL_Rt_Rtk_NK: format_number_pt_br(
          L_Rt_Rtk_NK.average_likes
        ),
        sumMaxLikesL_Rt_Rtk_NK: L_Rt_Rtk_NK_max_value.maxLikes,
        sumAverageRetweetsL_Rt_Rtk_NK: format_number_pt_br(
          L_Rt_Rtk_NK.average_retweets
        ),
        sumMaxRetweetsL_Rt_Rtk_NK: L_Rt_Rtk_NK_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsL_Rt_Rtk_NK: format_number_pt_br(
          L_Rt_Rtk_NK.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsL_Rt_Rtk_NK:
          L_Rt_Rtk_NK_max_value.maxRetweetsWithComments,
        sumAverageCommentsL_Rt_Rtk_NK: format_number_pt_br(
          L_Rt_Rtk_NK.average_comments
        ),
        sumMaxCommentsL_Rt_Rtk_NK: L_Rt_Rtk_NK_max_value.maxComments,
        mobEfetiveL_Rt_Rtk_NK: format_number_pt_br(L_Rt_Rtk_NK.mobEfetive),
        sumFreqNL_Rt_Rtk_K: format_number_pt_br(NL_Rt_Rtk_K.freq),
        sumAverageLikesNL_Rt_Rtk_K: format_number_pt_br(
          NL_Rt_Rtk_K.average_likes
        ),
        sumMaxLikesNL_Rt_Rtk_K: NL_Rt_Rtk_K_max_value.maxLikes,
        sumAverageRetweetsNL_Rt_Rtk_K: format_number_pt_br(
          NL_Rt_Rtk_K.average_retweets
        ),
        sumMaxRetweetsNL_Rt_Rtk_K: NL_Rt_Rtk_K_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsNL_Rt_Rtk_K: format_number_pt_br(
          NL_Rt_Rtk_K.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsNL_Rt_Rtk_K:
          NL_Rt_Rtk_K_max_value.maxRetweetsWithComments,
        sumAverageCommentsNL_Rt_Rtk_K: format_number_pt_br(
          NL_Rt_Rtk_K.average_comments
        ),
        sumMaxCommentsNL_Rt_Rtk_K: NL_Rt_Rtk_K_max_value.maxComments,
        mobEfetiveNL_Rt_Rtk_K: format_number_pt_br(NL_Rt_Rtk_K.mobEfetive),
        sumFreqL_Rt_NRtk_K: format_number_pt_br(L_Rt_NRtk_K.freq),
        sumAverageLikesL_Rt_NRtk_K: format_number_pt_br(
          L_Rt_NRtk_K.average_likes
        ),
        sumMaxLikesL_Rt_NRtk_K: L_Rt_NRtk_K_max_value.maxLikes,
        sumAverageRetweetsL_Rt_NRtk_K: format_number_pt_br(
          L_Rt_NRtk_K.average_retweets
        ),
        sumMaxRetweetsL_Rt_NRtk_K: L_Rt_NRtk_K_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsL_Rt_NRtk_K: format_number_pt_br(
          L_Rt_NRtk_K.average_retweets_with_comments
        ),
        sumMaxReweetsWithCommentsL_Rt_NRtk_K:
          L_Rt_NRtk_K_max_value.maxRetweetsWithComments,
        sumAverageCommentsL_Rt_NRtk_K: format_number_pt_br(
          L_Rt_NRtk_K.average_comments
        ),
        sumMaxCommentsL_Rt_NRtk_K: L_Rt_NRtk_K_max_value.maxComments,
        mobEfetiveL_Rt_NRtk_K: format_number_pt_br(L_Rt_NRtk_K.mobEfetive),
        sumFreqL_NRt_Rtk_K: format_number_pt_br(L_NRt_Rtk_K.freq),
        sumAverageLikesL_NRt_Rtk_K: format_number_pt_br(
          L_NRt_Rtk_K.average_likes
        ),
        sumMaxLikesL_NRt_Rtk_K: L_NRt_Rtk_K_max_value.maxLikes,
        sumAverageRetweetsL_NRt_Rtk_K: format_number_pt_br(
          L_NRt_Rtk_K.average_retweets
        ),
        sumMaxRetweetsL_NRt_Rtk_K: L_NRt_Rtk_K_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsL_NRt_Rtk_K: format_number_pt_br(
          L_NRt_Rtk_K.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsL_NRt_Rtk_K:
          L_NRt_Rtk_K_max_value.maxRetweetsWithComments,
        sumAverageCommentsL_NRt_Rtk_K: format_number_pt_br(
          L_NRt_Rtk_K.average_comments
        ),
        sumMaxCommentsL_NRt_Rtk_K: L_NRt_Rtk_K_max_value.maxComments,
        mobEfetiveL_NRt_Rtk_K: format_number_pt_br(L_NRt_Rtk_K.mobEfetive),
        sumFreqL_Rt_Rtk_K: format_number_pt_br(L_Rt_Rtk_K.freq),
        sumAverageLikesL_Rt_Rtk_K: format_number_pt_br(
          L_Rt_Rtk_K.average_likes
        ),
        sumMaxLikesL_Rt_Rtk_K: L_Rt_Rtk_K_max_value.maxLikes,
        sumAverageRetweetsL_Rt_Rtk_K: format_number_pt_br(
          L_Rt_Rtk_K.average_retweets
        ),
        sumMaxRetweetsL_Rt_Rtk_K: L_Rt_Rtk_K_max_value.maxRetweets,
        sumAverageRetweetsWithCommentsL_Rt_Rtk_K: format_number_pt_br(
          L_Rt_Rtk_K.average_retweets_with_comments
        ),
        sumMaxRetweetsWithCommentsL_Rt_Rtk_K:
          L_Rt_Rtk_K_max_value.maxRetweetsWithComments,
        sumAverageCommentsL_Rt_Rtk_K: format_number_pt_br(
          L_Rt_Rtk_K.average_comments
        ),
        sumMaxCommentsL_Rt_Rtk_K: L_Rt_Rtk_K_max_value.maxComments,
        mobEfetiveL_Rt_Rtk_K: format_number_pt_br(L_Rt_Rtk_K.mobEfetive),
        sumGspFreq: format_number_pt_br(sumGspFreq.toFixed(2)),
        sumGspAverageLikes,
        sumGspMaxLikes: sum_reports.sumGspMaxLikes,
        sumGspAverageRetweets,
        sumGspMaxRetweets: sum_reports.sumGspMaxRetweets,
        sumGspAverageRetweetsWithComments,
        sumGspMaxRetweetsWithComments:
          sum_reports.sumGspMaxRetweetsWithComments,
        sumGspAverageComments,
        sumGspMaxComments: sum_reports.sumGspMaxComments,
        sumGspMobEfetive: format_number_pt_br(sumGspMobEfetive.toFixed(2)),
        sum_freq_positive_NL_NRt_NRtk_NK: format_number_pt_br(
          positive_NL_NRt_NRtk_NK.freq
        ),
        sum_average_likes_positive_NL_NRt_NRtk_NK: format_number_pt_br(
          positive_NL_NRt_NRtk_NK.average_likes
        ),
        sumMaxLikesPositive_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_positive_max_value.maxLikes,
        sum_average_retweets_positive_NL_NRt_NRtk_NK: format_number_pt_br(
          positive_NL_NRt_NRtk_NK.average_retweets
        ),
        sumMaxRetweetsPositive_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_NL_NRt_NRtk_NK:
          format_number_pt_br(
            positive_NL_NRt_NRtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_NL_NRt_NRtk_NK: format_number_pt_br(
          positive_NL_NRt_NRtk_NK.average_comments
        ),
        sumMaxCommentsPositive_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_positive_max_value.maxComments,
        sumAverageOfAveragePositive_NL_NRt_NRtk_NK: format_number_pt_br(
          positive_NL_NRt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetivePositive_NL_NRt_NRtk_NK: format_number_pt_br(
          positive_NL_NRt_NRtk_NK.mobEfetive
        ),
        sum_freq_positive_NL_NRt_NRtk_K: format_number_pt_br(
          positive_NL_NRt_NRtk_K.freq
        ),
        sum_average_likes_positive_NL_NRt_NRtk_K: format_number_pt_br(
          positive_NL_NRt_NRtk_K.average_likes
        ),
        sumMaxLikesPositive_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_positive_max_value.maxLikes,
        sum_average_retweets_positive_NL_NRt_NRtk_K: format_number_pt_br(
          positive_NL_NRt_NRtk_K.average_retweets
        ),
        sumMaxRetweetsPositive_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_NL_NRt_NRtk_K:
          format_number_pt_br(
            positive_NL_NRt_NRtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_NL_NRt_NRtk_K: format_number_pt_br(
          positive_NL_NRt_NRtk_K.average_comments
        ),
        sumMaxCommentsPositive_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_positive_max_value.maxComments,
        sumAverageOfAveragePositive_NL_NRt_NRtk_K: format_number_pt_br(
          positive_NL_NRt_NRtk_K.averageOfAverage
        ),
        sumMobEfetivePositive_NL_NRt_NRtk_K: format_number_pt_br(
          positive_NL_NRt_NRtk_K.mobEfetive
        ),
        sum_freq_positive_NL_NRt_Rtk_NK: format_number_pt_br(
          positive_NL_NRt_Rtk_NK.freq
        ),
        sum_average_likes_positive_NL_NRt_Rtk_NK: format_number_pt_br(
          positive_NL_NRt_Rtk_NK.average_likes
        ),
        sumMaxLikesPositive_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_positive_max_value.maxLikes,
        sum_average_retweets_positive_NL_NRt_Rtk_NK: format_number_pt_br(
          positive_NL_NRt_Rtk_NK.average_retweets
        ),
        sumMaxRetweetsPositive_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_NL_NRt_Rtk_NK:
          format_number_pt_br(
            positive_NL_NRt_Rtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_NL_NRt_Rtk_NK: format_number_pt_br(
          positive_NL_NRt_Rtk_NK.average_comments
        ),
        sumMaxCommentsPositive_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_positive_max_value.maxComments,
        sumAverageOfAveragePositive_NL_NRt_Rtk_NK: format_number_pt_br(
          positive_NL_NRt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetivePositive_NL_NRt_Rtk_NK: format_number_pt_br(
          positive_NL_NRt_Rtk_NK.mobEfetive
        ),
        sum_freq_positive_NL_Rt_NRtk_NK: format_number_pt_br(
          positive_NL_Rt_NRtk_NK.freq
        ),
        sum_average_likes_positive_NL_Rt_NRtk_NK: format_number_pt_br(
          positive_NL_Rt_NRtk_NK.average_likes
        ),
        sumMaxLikesPositive_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_positive_max_value.maxLikes,
        sum_average_retweets_positive_NL_Rt_NRtk_NK: format_number_pt_br(
          positive_NL_Rt_NRtk_NK.average_retweets
        ),
        sumMaxRetweetsPositive_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_NL_Rt_NRtk_NK:
          format_number_pt_br(
            positive_NL_Rt_NRtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_NL_Rt_NRtk_NK: format_number_pt_br(
          positive_NL_Rt_NRtk_NK.average_comments
        ),
        sumMaxCommentsPositive_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_positive_max_value.maxComments,
        sumAverageOfAveragePositive_NL_Rt_NRtk_NK: format_number_pt_br(
          positive_NL_Rt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetivePositive_NL_Rt_NRtk_NK: format_number_pt_br(
          positive_NL_Rt_NRtk_NK.mobEfetive
        ),
        sum_freq_positive_L_NRt_NRtk_NK: format_number_pt_br(
          positive_L_NRt_NRtk_NK.freq
        ),
        sum_average_likes_positive_L_NRt_NRtk_NK: format_number_pt_br(
          positive_L_NRt_NRtk_NK.average_likes
        ),
        sumMaxLikesPositive_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_positive_max_value.maxLikes,
        sum_average_retweets_positive_L_NRt_NRtk_NK: format_number_pt_br(
          positive_L_NRt_NRtk_NK.average_retweets
        ),
        sumMaxRetweetsPositive_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_L_NRt_NRtk_NK:
          format_number_pt_br(
            positive_L_NRt_NRtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_L_NRt_NRtk_NK: format_number_pt_br(
          positive_L_NRt_NRtk_NK.average_comments
        ),
        sumMaxCommentsPositive_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_positive_max_value.maxComments,
        sumAverageOfAveragePositive_L_NRt_NRtk_NK: format_number_pt_br(
          positive_L_NRt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetivePositive_L_NRt_NRtk_NK: format_number_pt_br(
          positive_L_NRt_NRtk_NK.mobEfetive
        ),
        sum_freq_positive_NL_NRt_Rtk_K: format_number_pt_br(
          positive_NL_NRt_Rtk_K.freq
        ),
        sum_average_likes_positive_NL_NRt_Rtk_K: format_number_pt_br(
          positive_NL_NRt_Rtk_K.average_likes
        ),
        sumMaxLikesPositive_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_positive_max_value.maxLikes,
        sum_average_retweets_positive_NL_NRt_Rtk_K: format_number_pt_br(
          positive_NL_NRt_Rtk_K.average_retweets
        ),
        sumMaxRetweetsPositive_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_NL_NRt_Rtk_K:
          format_number_pt_br(
            positive_NL_NRt_Rtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_NL_NRt_Rtk_K: format_number_pt_br(
          positive_NL_NRt_Rtk_K.average_comments
        ),
        sumMaxCommentsPositive_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_positive_max_value.maxComments,
        sumAverageOfAveragePositive_NL_NRt_Rtk_K: format_number_pt_br(
          positive_NL_NRt_Rtk_K.averageOfAverage
        ),
        sumMobEfetivePositive_NL_NRt_Rtk_K: format_number_pt_br(
          positive_NL_NRt_Rtk_K.mobEfetive
        ),
        sum_freq_positive_NL_Rt_NRtk_K: format_number_pt_br(
          positive_NL_Rt_NRtk_K.freq
        ),
        sum_average_likes_positive_NL_Rt_NRtk_K: format_number_pt_br(
          positive_NL_Rt_NRtk_K.average_likes
        ),
        sumMaxLikesPositive_NL_Rt_NRtk_K: NL_Rt_NRtk_K_max_value.maxLikes,
        sum_average_retweets_positive_NL_Rt_NRtk_K: format_number_pt_br(
          positive_NL_Rt_NRtk_K.average_retweets
        ),
        sumMaxRetweetsPositive_NL_Rt_NRtk_K: NL_Rt_NRtk_K_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_NL_Rt_NRtk_K:
          format_number_pt_br(
            positive_NL_Rt_NRtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_NL_Rt_NRtk_K: format_number_pt_br(
          positive_NL_Rt_NRtk_K.average_comments
        ),
        sumMaxCommentsPositive_NL_Rt_NRtk_K: NL_Rt_NRtk_K_max_value.maxComments,
        sumAverageOfAveragePositive_NL_Rt_NRtk_K: format_number_pt_br(
          positive_NL_Rt_NRtk_K.averageOfAverage
        ),
        sumMobEfetivePositive_NL_Rt_NRtk_K: format_number_pt_br(
          positive_NL_Rt_NRtk_K.mobEfetive
        ),
        sum_freq_positive_L_NRt_NRtk_K: format_number_pt_br(
          positive_L_NRt_NRtk_K.freq
        ),
        sum_average_likes_positive_L_NRt_NRtk_K: format_number_pt_br(
          positive_L_NRt_NRtk_K.average_likes
        ),
        sumMaxLikesPositive_L_NRt_NRtk_K: L_NRt_NRtk_K_max_value.maxLikes,
        sum_average_retweets_positive_L_NRt_NRtk_K: format_number_pt_br(
          positive_L_NRt_NRtk_K.average_retweets
        ),
        sumMaxRetweetsPositive_L_NRt_NRtk_K: L_NRt_NRtk_K_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_L_NRt_NRtk_K:
          format_number_pt_br(
            positive_L_NRt_NRtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_L_NRt_NRtk_K:
          L_NRt_NRtk_K_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_L_NRt_NRtk_K: format_number_pt_br(
          positive_L_NRt_NRtk_K.average_comments
        ),
        sumMaxCommentsPositive_L_NRt_NRtk_K: L_NRt_NRtk_K_max_value.maxComments,
        sumAverageOfAveragePositive_L_NRt_NRtk_K: format_number_pt_br(
          positive_L_NRt_NRtk_K.averageOfAverage
        ),
        sumMobEfetivePositive_L_NRt_NRtk_K: format_number_pt_br(
          positive_L_NRt_NRtk_K.mobEfetive
        ),
        sum_freq_positive_NL_Rt_Rtk_NK: format_number_pt_br(
          positive_NL_Rt_Rtk_NK.freq
        ),
        sum_average_likes_positive_NL_Rt_Rtk_NK: format_number_pt_br(
          positive_NL_Rt_Rtk_NK.average_likes
        ),
        sumMaxLikesPositive_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_positive_max_value.maxLikes,
        sum_average_retweets_positive_NL_Rt_Rtk_NK: format_number_pt_br(
          positive_NL_Rt_Rtk_NK.average_retweets
        ),
        sumMaxRetweetsPositive_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_NL_Rt_Rtk_NK:
          format_number_pt_br(
            positive_NL_Rt_Rtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_NL_Rt_Rtk_NK: format_number_pt_br(
          positive_NL_Rt_Rtk_NK.average_comments
        ),
        sumMaxCommentsPositive_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_positive_max_value.maxComments,
        sumAverageOfAveragePositive_NL_Rt_Rtk_NK: format_number_pt_br(
          positive_NL_Rt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetivePositive_NL_Rt_Rtk_NK: format_number_pt_br(
          positive_NL_Rt_Rtk_NK.mobEfetive
        ),
        sum_freq_positive_L_NRt_Rtk_NK: format_number_pt_br(
          positive_L_NRt_Rtk_NK.freq
        ),
        sum_average_likes_positive_L_NRt_Rtk_NK: format_number_pt_br(
          positive_L_NRt_Rtk_NK.average_likes
        ),
        sumMaxLikesPositive_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_positive_max_value.maxLikes,
        sum_average_retweets_positive_L_NRt_Rtk_NK: format_number_pt_br(
          positive_L_NRt_Rtk_NK.average_retweets
        ),
        sumMaxRetweetsPositive_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_L_NRt_Rtk_NK:
          format_number_pt_br(
            positive_L_NRt_Rtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_L_NRt_Rtk_NK: format_number_pt_br(
          positive_L_NRt_Rtk_NK.average_comments
        ),
        sumMaxCommentsPositive_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_positive_max_value.maxComments,
        sumAverageOfAveragePositive_L_NRt_Rtk_NK: format_number_pt_br(
          positive_L_NRt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetivePositive_L_NRt_Rtk_NK: format_number_pt_br(
          positive_L_NRt_Rtk_NK.mobEfetive
        ),
        sum_freq_positive_L_Rt_NRtk_NK: format_number_pt_br(
          positive_L_Rt_NRtk_NK.freq
        ),
        sum_average_likes_positive_L_Rt_NRtk_NK: format_number_pt_br(
          positive_L_Rt_NRtk_NK.average_likes
        ),
        sumMaxLikesPositive_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_positive_max_value.maxLikes,
        sum_average_retweets_positive_L_Rt_NRtk_NK: format_number_pt_br(
          positive_L_Rt_NRtk_NK.average_retweets
        ),
        sumMaxRetweetsPositive_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_L_Rt_NRtk_NK:
          format_number_pt_br(
            positive_L_Rt_NRtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_L_Rt_NRtk_NK: format_number_pt_br(
          positive_L_Rt_NRtk_NK.average_comments
        ),
        sumMaxCommentsPositive_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_positive_max_value.maxComments,
        sumAverageOfAveragePositive_L_Rt_NRtk_NK: format_number_pt_br(
          positive_L_Rt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetivePositive_L_Rt_NRtk_NK: format_number_pt_br(
          positive_L_Rt_NRtk_NK.mobEfetive
        ),
        sum_freq_positive_L_Rt_Rtk_NK: format_number_pt_br(
          positive_L_Rt_Rtk_NK.freq
        ),
        sum_average_likes_positive_L_Rt_Rtk_NK: format_number_pt_br(
          positive_L_Rt_Rtk_NK.average_likes
        ),
        sumMaxLikesPositive_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_positive_max_value.maxLikes,
        sum_average_retweets_positive_L_Rt_Rtk_NK: format_number_pt_br(
          positive_L_Rt_Rtk_NK.average_retweets
        ),
        sumMaxRetweetsPositive_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_L_Rt_Rtk_NK:
          format_number_pt_br(
            positive_L_Rt_Rtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_L_Rt_Rtk_NK: format_number_pt_br(
          positive_L_Rt_Rtk_NK.average_comments
        ),
        sumMaxCommentsPositive_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_positive_max_value.maxComments,
        sumAverageOfAveragePositive_L_Rt_Rtk_NK: format_number_pt_br(
          positive_L_Rt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetivePositive_L_Rt_Rtk_NK: format_number_pt_br(
          positive_L_Rt_Rtk_NK.mobEfetive
        ),
        sum_freq_positive_NL_Rt_Rtk_K: format_number_pt_br(
          positive_NL_Rt_Rtk_K.freq
        ),
        sum_average_likes_positive_NL_Rt_Rtk_K: format_number_pt_br(
          positive_NL_Rt_Rtk_K.average_likes
        ),
        sumMaxLikesPositive_NL_Rt_Rtk_K:
          NL_Rt_Rtk_K_positive_max_value.maxLikes,
        sum_average_retweets_positive_NL_Rt_Rtk_K: format_number_pt_br(
          positive_NL_Rt_Rtk_K.average_retweets
        ),
        sumMaxRetweetsPositive_NL_Rt_Rtk_K:
          NL_Rt_Rtk_K_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_NL_Rt_Rtk_K:
          format_number_pt_br(
            positive_NL_Rt_Rtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_NL_Rt_Rtk_K:
          NL_Rt_Rtk_K_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_NL_Rt_Rtk_K: format_number_pt_br(
          positive_NL_Rt_Rtk_K.average_comments
        ),
        sumMaxCommentsPositive_NL_Rt_Rtk_K:
          NL_Rt_Rtk_K_positive_max_value.maxComments,
        sumAverageOfAveragePositive_NL_Rt_Rtk_K: format_number_pt_br(
          positive_NL_Rt_Rtk_K.averageOfAverage
        ),
        sumMobEfetivePositive_NL_Rt_Rtk_K: format_number_pt_br(
          positive_NL_Rt_Rtk_K.mobEfetive
        ),
        sum_freq_positive_L_Rt_NRtk_K: format_number_pt_br(
          positive_L_Rt_NRtk_K.freq
        ),
        sum_average_likes_positive_L_Rt_NRtk_K: format_number_pt_br(
          positive_L_Rt_NRtk_K.average_likes
        ),
        sumMaxLikesPositive_L_Rt_NRtk_K:
          L_Rt_NRtk_K_positive_max_value.maxLikes,
        sum_average_retweets_positive_L_Rt_NRtk_K: format_number_pt_br(
          positive_L_Rt_NRtk_K.average_retweets
        ),
        sumMaxRetweetsPositive_L_Rt_NRtk_K:
          L_Rt_NRtk_K_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_L_Rt_NRtk_K:
          format_number_pt_br(
            positive_L_Rt_NRtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_L_Rt_NRtk_K:
          L_Rt_NRtk_K_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_L_Rt_NRtk_K: format_number_pt_br(
          positive_L_Rt_NRtk_K.average_comments
        ),
        sumMaxCommentsPositive_L_Rt_NRtk_K:
          L_Rt_NRtk_K_positive_max_value.maxComments,
        sumAverageOfAveragePositive_L_Rt_NRtk_K: format_number_pt_br(
          positive_L_Rt_NRtk_K.averageOfAverage
        ),
        sumMobEfetivePositive_L_Rt_NRtk_K: format_number_pt_br(
          positive_L_Rt_NRtk_K.mobEfetive
        ),
        sum_freq_positive_L_NRt_Rtk_K: format_number_pt_br(
          positive_L_NRt_Rtk_K.freq
        ),
        sum_average_likes_positive_L_NRt_Rtk_K: format_number_pt_br(
          positive_L_NRt_Rtk_K.average_likes
        ),
        sumMaxLikesPositive_L_NRt_Rtk_K:
          L_NRt_Rtk_K_positive_max_value.maxLikes,
        sum_average_retweets_positive_L_NRt_Rtk_K: format_number_pt_br(
          positive_L_NRt_Rtk_K.average_retweets
        ),
        sumMaxRetweetsPositive_L_NRt_Rtk_K:
          L_NRt_Rtk_K_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_L_NRt_Rtk_K:
          format_number_pt_br(
            positive_L_NRt_Rtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_L_NRt_Rtk_K:
          L_NRt_Rtk_K_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_L_NRt_Rtk_K: format_number_pt_br(
          positive_L_NRt_Rtk_K.average_comments
        ),
        sumMaxCommentsPositive_L_NRt_Rtk_K:
          L_NRt_Rtk_K_positive_max_value.maxComments,
        sumAverageOfAveragePositive_L_NRt_Rtk_K: format_number_pt_br(
          positive_L_NRt_Rtk_K.averageOfAverage
        ),
        sumMobEfetivePositive_L_NRt_Rtk_K: format_number_pt_br(
          positive_L_NRt_Rtk_K.mobEfetive
        ),
        sum_freq_positive_L_Rt_Rtk_K: format_number_pt_br(
          positive_L_Rt_Rtk_K.freq
        ),
        sum_average_likes_positive_L_Rt_Rtk_K: format_number_pt_br(
          positive_L_Rt_Rtk_K.average_likes
        ),
        sumMaxLikesPositive_L_Rt_Rtk_K: L_Rt_Rtk_K_positive_max_value.maxLikes,
        sum_average_retweets_positive_L_Rt_Rtk_K: format_number_pt_br(
          positive_L_Rt_Rtk_K.average_retweets
        ),
        sumMaxRetweetsPositive_L_Rt_Rtk_K:
          L_Rt_Rtk_K_positive_max_value.maxRetweets,
        sum_average_retweets_with_comments_positive_L_Rt_Rtk_K:
          format_number_pt_br(
            positive_L_Rt_Rtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsPositive_L_Rt_Rtk_K:
          L_Rt_Rtk_K_positive_max_value.maxRetweetsWithComments,
        sum_average_comments_positive_L_Rt_Rtk_K: format_number_pt_br(
          positive_L_Rt_Rtk_K.average_comments
        ),
        sumMaxCommentsPositive_L_Rt_Rtk_K:
          L_Rt_Rtk_K_positive_max_value.maxComments,
        sumAverageOfAveragePositive_L_Rt_Rtk_K: format_number_pt_br(
          positive_L_Rt_Rtk_K.averageOfAverage
        ),
        sumMobEfetivePositive_L_Rt_Rtk_K: format_number_pt_br(
          positive_L_Rt_Rtk_K.mobEfetive
        ),
        sum_freq_neutral_NL_NRt_NRtk_NK: format_number_pt_br(
          neutral_NL_NRt_NRtk_NK.freq
        ),
        sum_average_likes_neutral_NL_NRt_NRtk_NK: format_number_pt_br(
          neutral_NL_NRt_NRtk_NK.average_likes
        ),
        sumMaxLikesNeutral_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_NL_NRt_NRtk_NK: format_number_pt_br(
          neutral_NL_NRt_NRtk_NK.average_retweets
        ),
        sumMaxRetweetsNeutral_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_NL_NRt_NRtk_NK:
          format_number_pt_br(
            neutral_NL_NRt_NRtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_NL_NRt_NRtk_NK: format_number_pt_br(
          neutral_NL_NRt_NRtk_NK.average_comments
        ),
        sumMaxCommentsNeutral_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_NL_NRt_NRtk_NK: format_number_pt_br(
          neutral_NL_NRt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetiveNeutral_NL_NRt_NRtk_NK: format_number_pt_br(
          neutral_NL_NRt_NRtk_NK.mobEfetive
        ),
        sum_freq_neutral_NL_NRt_NRtk_K: format_number_pt_br(
          neutral_NL_NRt_NRtk_K.freq
        ),
        sum_average_likes_neutral_NL_NRt_NRtk_K: format_number_pt_br(
          neutral_NL_NRt_NRtk_K.average_likes
        ),
        sumMaxLikesNeutral_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_NL_NRt_NRtk_K: format_number_pt_br(
          neutral_NL_NRt_NRtk_K.average_retweets
        ),
        sumMaxRetweetsNeutral_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_NL_NRt_NRtk_K:
          format_number_pt_br(
            neutral_NL_NRt_NRtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_NL_NRt_NRtk_K: format_number_pt_br(
          neutral_NL_NRt_NRtk_K.average_comments
        ),
        sumMaxCommentsNeutral_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_NL_NRt_NRtk_K: format_number_pt_br(
          neutral_NL_NRt_NRtk_K.averageOfAverage
        ),
        sumMobEfetiveNeutral_NL_NRt_NRtk_K: format_number_pt_br(
          neutral_NL_NRt_NRtk_K.mobEfetive
        ),
        sum_freq_neutral_NL_NRt_Rtk_NK: format_number_pt_br(
          neutral_NL_NRt_Rtk_NK.freq
        ),
        sum_average_likes_neutral_NL_NRt_Rtk_NK: format_number_pt_br(
          neutral_NL_NRt_Rtk_NK.average_likes
        ),
        sumMaxLikesNeutral_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_NL_NRt_Rtk_NK: format_number_pt_br(
          neutral_NL_NRt_Rtk_NK.average_retweets
        ),
        sumMaxRetweetsNeutral_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_NL_NRt_Rtk_NK:
          format_number_pt_br(
            neutral_NL_NRt_Rtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_NL_NRt_Rtk_NK: format_number_pt_br(
          neutral_NL_NRt_Rtk_NK.average_comments
        ),
        sumMaxCommentsNeutral_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_NL_NRt_Rtk_NK: format_number_pt_br(
          neutral_NL_NRt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetiveNeutral_NL_NRt_Rtk_NK: format_number_pt_br(
          neutral_NL_NRt_Rtk_NK.mobEfetive
        ),
        sum_freq_neutral_NL_Rt_NRtk_NK: format_number_pt_br(
          neutral_NL_Rt_NRtk_NK.freq
        ),
        sum_average_likes_neutral_NL_Rt_NRtk_NK: format_number_pt_br(
          neutral_NL_Rt_NRtk_NK.average_likes
        ),
        sumMaxLikesNeutral_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_NL_Rt_NRtk_NK: format_number_pt_br(
          neutral_NL_Rt_NRtk_NK.average_retweets
        ),
        sumMaxRetweetsNeutral_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_NL_Rt_NRtk_NK:
          format_number_pt_br(
            neutral_NL_Rt_NRtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_NL_Rt_NRtk_NK: format_number_pt_br(
          neutral_NL_Rt_NRtk_NK.average_comments
        ),
        sumMaxCommentsNeutral_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_NL_Rt_NRtk_NK: format_number_pt_br(
          neutral_NL_Rt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetiveNeutral_NL_Rt_NRtk_NK: format_number_pt_br(
          neutral_NL_Rt_NRtk_NK.mobEfetive
        ),
        sum_freq_neutral_L_NRt_NRtk_NK: format_number_pt_br(
          neutral_L_NRt_NRtk_NK.freq
        ),
        sum_average_likes_neutral_L_NRt_NRtk_NK: format_number_pt_br(
          neutral_L_NRt_NRtk_NK.average_likes
        ),
        sumMaxLikesNeutral_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_L_NRt_NRtk_NK: format_number_pt_br(
          neutral_L_NRt_NRtk_NK.average_retweets
        ),
        sumMaxRetweetsNeutral_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_L_NRt_NRtk_NK:
          format_number_pt_br(
            neutral_L_NRt_NRtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_L_NRt_NRtk_NK: format_number_pt_br(
          neutral_L_NRt_NRtk_NK.average_comments
        ),
        sumMaxCommentsNeutral_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_L_NRt_NRtk_NK: format_number_pt_br(
          neutral_L_NRt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetiveNeutral_L_NRt_NRtk_NK: format_number_pt_br(
          neutral_L_NRt_NRtk_NK.mobEfetive
        ),
        sum_freq_neutral_NL_NRt_Rtk_K: format_number_pt_br(
          neutral_NL_NRt_Rtk_K.freq
        ),
        sum_average_likes_neutral_NL_NRt_Rtk_K: format_number_pt_br(
          neutral_NL_NRt_Rtk_K.average_likes
        ),
        sumMaxLikesNeutral_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_NL_NRt_Rtk_K: format_number_pt_br(
          neutral_NL_NRt_Rtk_K.average_retweets
        ),
        sumMaxRetweetsNeutral_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_NL_NRt_Rtk_K:
          format_number_pt_br(
            neutral_NL_NRt_Rtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_NL_NRt_Rtk_K: format_number_pt_br(
          neutral_NL_NRt_Rtk_K.average_comments
        ),
        sumMaxCommentsNeutral_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_NL_NRt_Rtk_K: format_number_pt_br(
          neutral_NL_NRt_Rtk_K.averageOfAverage
        ),
        sumMobEfetiveNeutral_NL_NRt_Rtk_K: format_number_pt_br(
          neutral_NL_NRt_Rtk_K.mobEfetive
        ),
        sum_freq_neutral_NL_Rt_NRtk_K: format_number_pt_br(
          neutral_NL_Rt_NRtk_K.freq
        ),
        sum_average_likes_neutral_NL_Rt_NRtk_K: format_number_pt_br(
          neutral_NL_Rt_NRtk_K.average_likes
        ),
        sumMaxLikesNeutral_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_NL_Rt_NRtk_K: format_number_pt_br(
          neutral_NL_Rt_NRtk_K.average_retweets
        ),
        sumMaxRetweetsNeutral_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_NL_Rt_NRtk_K:
          format_number_pt_br(
            neutral_NL_Rt_NRtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_NL_Rt_NRtk_K: format_number_pt_br(
          neutral_NL_Rt_NRtk_K.average_comments
        ),
        sumMaxCommentsNeutral_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_NL_Rt_NRtk_K: format_number_pt_br(
          neutral_NL_Rt_NRtk_K.averageOfAverage
        ),
        sumMobEfetiveNeutral_NL_Rt_NRtk_K: format_number_pt_br(
          neutral_NL_Rt_NRtk_K.mobEfetive
        ),
        sum_freq_neutral_L_NRt_NRtk_K: format_number_pt_br(
          neutral_L_NRt_NRtk_K.freq
        ),
        sum_average_likes_neutral_L_NRt_NRtk_K: format_number_pt_br(
          neutral_L_NRt_NRtk_K.average_likes
        ),
        sumMaxLikesNeutral_L_NRt_NRtk_K:
          L_NRt_NRtk_K_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_L_NRt_NRtk_K: format_number_pt_br(
          neutral_L_NRt_NRtk_K.average_retweets
        ),
        sumMaxRetweetsNeutral_L_NRt_NRtk_K:
          L_NRt_NRtk_K_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_L_NRt_NRtk_K:
          format_number_pt_br(
            neutral_L_NRt_NRtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_L_NRt_NRtk_K:
          L_NRt_NRtk_K_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_L_NRt_NRtk_K: format_number_pt_br(
          neutral_L_NRt_NRtk_K.average_comments
        ),
        sumMaxCommentsNeutral_L_NRt_NRtk_K:
          L_NRt_NRtk_K_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_L_NRt_NRtk_K: format_number_pt_br(
          neutral_L_NRt_NRtk_K.averageOfAverage
        ),
        sumMobEfetiveNeutral_L_NRt_NRtk_K: format_number_pt_br(
          neutral_L_NRt_NRtk_K.mobEfetive
        ),
        sum_freq_neutral_NL_Rt_Rtk_NK: format_number_pt_br(
          neutral_NL_Rt_Rtk_NK.freq
        ),
        sum_average_likes_neutral_NL_Rt_Rtk_NK: format_number_pt_br(
          neutral_NL_Rt_Rtk_NK.average_likes
        ),
        sumMaxLikesNeutral_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_NL_Rt_Rtk_NK: format_number_pt_br(
          neutral_NL_Rt_Rtk_NK.average_retweets
        ),
        sumMaxRetweetsNeutral_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_NL_Rt_Rtk_NK:
          format_number_pt_br(
            neutral_NL_Rt_Rtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_NL_Rt_Rtk_NK: format_number_pt_br(
          neutral_NL_Rt_Rtk_NK.average_comments
        ),
        sumMaxCommentsNeutral_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_NL_Rt_Rtk_NK: format_number_pt_br(
          neutral_NL_Rt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetiveNeutral_NL_Rt_Rtk_NK: format_number_pt_br(
          neutral_NL_Rt_Rtk_NK.mobEfetive
        ),
        sum_freq_neutral_L_NRt_Rtk_NK: format_number_pt_br(
          neutral_L_NRt_Rtk_NK.freq
        ),
        sum_average_likes_neutral_L_NRt_Rtk_NK: format_number_pt_br(
          neutral_L_NRt_Rtk_NK.average_likes
        ),
        sumMaxLikesNeutral_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_L_NRt_Rtk_NK: format_number_pt_br(
          neutral_L_NRt_Rtk_NK.average_retweets
        ),
        sumMaxRetweetsNeutral_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_L_NRt_Rtk_NK:
          format_number_pt_br(
            neutral_L_NRt_Rtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_L_NRt_Rtk_NK: format_number_pt_br(
          neutral_L_NRt_Rtk_NK.average_comments
        ),
        sumMaxCommentsNeutral_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_L_NRt_Rtk_NK: format_number_pt_br(
          neutral_L_NRt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetiveNeutral_L_NRt_Rtk_NK: format_number_pt_br(
          neutral_L_NRt_Rtk_NK.mobEfetive
        ),
        sum_freq_neutral_L_Rt_NRtk_NK: format_number_pt_br(
          neutral_L_Rt_NRtk_NK.freq
        ),
        sum_average_likes_neutral_L_Rt_NRtk_NK: format_number_pt_br(
          neutral_L_Rt_NRtk_NK.average_likes
        ),
        sumMaxLikesNeutral_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_L_Rt_NRtk_NK: format_number_pt_br(
          neutral_L_Rt_NRtk_NK.average_retweets
        ),
        sumMaxRetweetsNeutral_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_L_Rt_NRtk_NK:
          format_number_pt_br(
            neutral_L_Rt_NRtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_L_Rt_NRtk_NK: format_number_pt_br(
          neutral_L_Rt_NRtk_NK.average_comments
        ),
        sumMaxCommentsNeutral_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_L_Rt_NRtk_NK: format_number_pt_br(
          neutral_L_Rt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetiveNeutral_L_Rt_NRtk_NK: format_number_pt_br(
          neutral_L_Rt_NRtk_NK.mobEfetive
        ),
        sum_freq_neutral_L_Rt_Rtk_NK: format_number_pt_br(
          neutral_L_Rt_Rtk_NK.freq
        ),
        sum_average_likes_neutral_L_Rt_Rtk_NK: format_number_pt_br(
          neutral_L_Rt_Rtk_NK.average_likes
        ),
        sumMaxLikesNeutral_L_Rt_Rtk_NK: L_Rt_Rtk_NK_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_L_Rt_Rtk_NK: format_number_pt_br(
          neutral_L_Rt_Rtk_NK.average_retweets
        ),
        sumMaxRetweetsNeutral_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_L_Rt_Rtk_NK:
          format_number_pt_br(
            neutral_L_Rt_Rtk_NK.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_L_Rt_Rtk_NK: format_number_pt_br(
          neutral_L_Rt_Rtk_NK.average_comments
        ),
        sumMaxCommentsNeutral_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_L_Rt_Rtk_NK: format_number_pt_br(
          neutral_L_Rt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetiveNeutral_L_Rt_Rtk_NK: format_number_pt_br(
          neutral_L_Rt_Rtk_NK.mobEfetive
        ),
        sum_freq_neutral_NL_Rt_Rtk_K: format_number_pt_br(
          neutral_NL_Rt_Rtk_K.freq
        ),
        sum_average_likes_neutral_NL_Rt_Rtk_K: format_number_pt_br(
          neutral_NL_Rt_Rtk_K.average_likes
        ),
        sumMaxLikesNeutral_NL_Rt_Rtk_K: NL_Rt_Rtk_K_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_NL_Rt_Rtk_K: format_number_pt_br(
          neutral_NL_Rt_Rtk_K.average_retweets
        ),
        sumMaxRetweetsNeutral_NL_Rt_Rtk_K:
          NL_Rt_Rtk_K_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_NL_Rt_Rtk_K:
          format_number_pt_br(
            neutral_NL_Rt_Rtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_NL_Rt_Rtk_K:
          NL_Rt_Rtk_K_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_NL_Rt_Rtk_K: format_number_pt_br(
          neutral_NL_Rt_Rtk_K.average_comments
        ),
        sumMaxCommentsNeutral_NL_Rt_Rtk_K:
          NL_Rt_Rtk_K_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_NL_Rt_Rtk_K: format_number_pt_br(
          neutral_NL_Rt_Rtk_K.averageOfAverage
        ),
        sumMobEfetiveNeutral_NL_Rt_Rtk_K: format_number_pt_br(
          neutral_NL_Rt_Rtk_K.mobEfetive
        ),
        sum_freq_neutral_L_Rt_NRtk_K: format_number_pt_br(
          neutral_L_Rt_NRtk_K.freq
        ),
        sum_average_likes_neutral_L_Rt_NRtk_K: format_number_pt_br(
          neutral_L_Rt_NRtk_K.average_likes
        ),
        sumMaxLikesNeutral_L_Rt_NRtk_K: L_Rt_NRtk_K_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_L_Rt_NRtk_K: format_number_pt_br(
          neutral_L_Rt_NRtk_K.average_retweets
        ),
        sumMaxRetweetsNeutral_L_Rt_NRtk_K:
          L_Rt_NRtk_K_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_L_Rt_NRtk_K:
          format_number_pt_br(
            neutral_L_Rt_NRtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_L_Rt_NRtk_K:
          L_Rt_NRtk_K_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_L_Rt_NRtk_K: format_number_pt_br(
          neutral_L_Rt_NRtk_K.average_comments
        ),
        sumMaxCommentsNeutral_L_Rt_NRtk_K:
          L_Rt_NRtk_K_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_L_Rt_NRtk_K: format_number_pt_br(
          neutral_L_Rt_NRtk_K.averageOfAverage
        ),
        sumMobEfetiveNeutral_L_Rt_NRtk_K: format_number_pt_br(
          neutral_L_Rt_NRtk_K.mobEfetive
        ),
        sum_freq_neutral_L_NRt_Rtk_K: format_number_pt_br(
          neutral_L_NRt_Rtk_K.freq
        ),
        sum_average_likes_neutral_L_NRt_Rtk_K: format_number_pt_br(
          neutral_L_NRt_Rtk_K.average_likes
        ),
        sumMaxLikesNeutral_L_NRt_Rtk_K: L_NRt_Rtk_K_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_L_NRt_Rtk_K: format_number_pt_br(
          neutral_L_NRt_Rtk_K.average_retweets
        ),
        sumMaxRetweetsNeutral_L_NRt_Rtk_K:
          L_NRt_Rtk_K_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_L_NRt_Rtk_K:
          format_number_pt_br(
            neutral_L_NRt_Rtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_L_NRt_Rtk_K:
          L_NRt_Rtk_K_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_L_NRt_Rtk_K: format_number_pt_br(
          neutral_L_NRt_Rtk_K.average_comments
        ),
        sumMaxCommentsNeutral_L_NRt_Rtk_K:
          L_NRt_Rtk_K_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_L_NRt_Rtk_K: format_number_pt_br(
          neutral_L_NRt_Rtk_K.averageOfAverage
        ),
        sumMobEfetiveNeutral_L_NRt_Rtk_K: format_number_pt_br(
          neutral_L_NRt_Rtk_K.mobEfetive
        ),
        sum_freq_neutral_L_Rt_Rtk_K: format_number_pt_br(
          neutral_L_Rt_Rtk_K.freq
        ),
        sum_average_likes_neutral_L_Rt_Rtk_K: format_number_pt_br(
          neutral_L_Rt_Rtk_K.average_likes
        ),
        sumMaxLikesNeutral_L_Rt_Rtk_K: L_Rt_Rtk_K_neutral_max_value.maxLikes,
        sum_average_retweets_neutral_L_Rt_Rtk_K: format_number_pt_br(
          neutral_L_Rt_Rtk_K.average_retweets
        ),
        sumMaxRetweetsNeutral_L_Rt_Rtk_K:
          L_Rt_Rtk_K_neutral_max_value.maxRetweets,
        sum_average_retweets_with_comments_neutral_L_Rt_Rtk_K:
          format_number_pt_br(
            neutral_L_Rt_Rtk_K.average_retweets_with_comments
          ),
        sumMaxRetweetsWithCommentsNeutral_L_Rt_Rtk_K:
          L_Rt_Rtk_K_neutral_max_value.maxRetweetsWithComments,
        sum_average_comments_neutral_L_Rt_Rtk_K: format_number_pt_br(
          neutral_L_Rt_Rtk_K.average_comments
        ),
        sumMaxCommentsNeutral_L_Rt_Rtk_K:
          L_Rt_Rtk_K_neutral_max_value.maxComments,
        sumAverageOfAverageNeutral_L_Rt_Rtk_K: format_number_pt_br(
          neutral_L_Rt_Rtk_K.averageOfAverage
        ),
        sumMobEfetiveNeutral_L_Rt_Rtk_K: format_number_pt_br(
          neutral_L_Rt_Rtk_K.mobEfetive
        ),
        sum_freq_negative_NL_NRt_NRtk_NK: format_number_pt_br(
          negative_NL_NRt_NRtk_NK.freq
        ),
        sum_average_likes_negative_NL_NRt_NRtk_NK: format_number_pt_br(
          negative_NL_NRt_NRtk_NK.average_likes
        ),
        sum_average_retweets_negative_NL_NRt_NRtk_NK: format_number_pt_br(
          negative_NL_NRt_NRtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_negative_NL_NRt_NRtk_NK:
          format_number_pt_br(
            negative_NL_NRt_NRtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_negative_NL_NRt_NRtk_NK: format_number_pt_br(
          negative_NL_NRt_NRtk_NK.average_comments
        ),
        sumMaxLikesNegative_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_negative_max_value.maxComments,
        sumAverageOfAverageNegative_NL_NRt_NRtk_NK: format_number_pt_br(
          negative_NL_NRt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetiveNegative_NL_NRt_NRtk_NK: format_number_pt_br(
          negative_NL_NRt_NRtk_NK.mobEfetive
        ),
        sum_freq_negative_NL_NRt_NRtk_K: format_number_pt_br(
          negative_NL_NRt_NRtk_K.freq
        ),
        sum_average_likes_negative_NL_NRt_NRtk_K: format_number_pt_br(
          negative_NL_NRt_NRtk_K.average_likes
        ),
        sum_average_retweets_negative_NL_NRt_NRtk_K: format_number_pt_br(
          negative_NL_NRt_NRtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_negative_NL_NRt_NRtk_K:
          format_number_pt_br(
            negative_NL_NRt_NRtk_K.average_retweets_with_comments
          ),
        sum_average_comments_negative_NL_NRt_NRtk_K: format_number_pt_br(
          negative_NL_NRt_NRtk_K.average_comments
        ),
        sumMaxLikesNegative_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_negative_max_value.maxComments,
        sumAverageOfAverageNegative_NL_NRt_NRtk_K: format_number_pt_br(
          negative_NL_NRt_NRtk_K.averageOfAverage
        ),
        sumMobEfetiveNegative_NL_NRt_NRtk_K: format_number_pt_br(
          negative_NL_NRt_NRtk_K.mobEfetive
        ),
        sum_freq_negative_NL_NRt_Rtk_NK: format_number_pt_br(
          negative_NL_NRt_Rtk_NK.freq
        ),
        sum_average_likes_negative_NL_NRt_Rtk_NK: format_number_pt_br(
          negative_NL_NRt_Rtk_NK.average_likes
        ),
        sum_average_retweets_negative_NL_NRt_Rtk_NK: format_number_pt_br(
          negative_NL_NRt_Rtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_negative_NL_NRt_Rtk_NK:
          format_number_pt_br(
            negative_NL_NRt_Rtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_negative_NL_NRt_Rtk_NK: format_number_pt_br(
          negative_NL_NRt_Rtk_NK.average_comments
        ),
        sumMaxLikesNegative_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_negative_max_value.maxComments,
        sumAverageOfAverageNegative_NL_NRt_Rtk_NK: format_number_pt_br(
          negative_NL_NRt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetiveNegative_NL_NRt_Rtk_NK: format_number_pt_br(
          negative_NL_NRt_Rtk_NK.mobEfetive
        ),
        sum_freq_negative_NL_Rt_NRtk_NK: format_number_pt_br(
          negative_NL_Rt_NRtk_NK.freq
        ),
        sum_average_likes_negative_NL_Rt_NRtk_NK: format_number_pt_br(
          negative_NL_Rt_NRtk_NK.average_likes
        ),
        sum_average_retweets_negative_NL_Rt_NRtk_NK: format_number_pt_br(
          negative_NL_Rt_NRtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_negative_NL_Rt_NRtk_NK:
          format_number_pt_br(
            negative_NL_Rt_NRtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_negative_NL_Rt_NRtk_NK: format_number_pt_br(
          negative_NL_Rt_NRtk_NK.average_comments
        ),
        sumMaxLikesNegative_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_negative_max_value.maxComments,
        sumAverageOfAverageNegative_NL_Rt_NRtk_NK: format_number_pt_br(
          negative_NL_Rt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetiveNegative_NL_Rt_NRtk_NK: format_number_pt_br(
          negative_NL_Rt_NRtk_NK.mobEfetive
        ),
        sum_freq_negative_L_NRt_NRtk_NK: format_number_pt_br(
          negative_L_NRt_NRtk_NK.freq
        ),
        sum_average_likes_negative_L_NRt_NRtk_NK: format_number_pt_br(
          negative_L_NRt_NRtk_NK.average_likes
        ),
        sum_average_retweets_negative_L_NRt_NRtk_NK: format_number_pt_br(
          negative_L_NRt_NRtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_negative_L_NRt_NRtk_NK:
          format_number_pt_br(
            negative_L_NRt_NRtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_negative_L_NRt_NRtk_NK: format_number_pt_br(
          negative_L_NRt_NRtk_NK.average_comments
        ),
        sumMaxLikesNegative_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_negative_max_value.maxComments,
        sumAverageOfAverageNegative_L_NRt_NRtk_NK: format_number_pt_br(
          negative_L_NRt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetiveNegative_L_NRt_NRtk_NK: format_number_pt_br(
          negative_L_NRt_NRtk_NK.mobEfetive
        ),
        sum_freq_negative_NL_NRt_Rtk_K: format_number_pt_br(
          negative_NL_NRt_Rtk_K.freq
        ),
        sum_average_likes_negative_NL_NRt_Rtk_K: format_number_pt_br(
          negative_NL_NRt_Rtk_K.average_likes
        ),
        sum_average_retweets_negative_NL_NRt_Rtk_K: format_number_pt_br(
          negative_NL_NRt_Rtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_negative_NL_NRt_Rtk_K:
          format_number_pt_br(
            negative_NL_NRt_Rtk_K.average_retweets_with_comments
          ),
        sum_average_comments_negative_NL_NRt_Rtk_K: format_number_pt_br(
          negative_NL_NRt_Rtk_K.average_comments
        ),
        sumMaxLikesNegative_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_negative_max_value.maxComments,
        sumAverageOfAverageNegative_NL_NRt_Rtk_K: format_number_pt_br(
          negative_NL_NRt_Rtk_K.averageOfAverage
        ),
        sumMobEfetiveNegative_NL_NRt_Rtk_K: format_number_pt_br(
          negative_NL_NRt_Rtk_K.mobEfetive
        ),
        sum_freq_negative_NL_Rt_NRtk_K: format_number_pt_br(
          negative_NL_Rt_NRtk_K.freq
        ),
        sum_average_likes_negative_NL_Rt_NRtk_K: format_number_pt_br(
          negative_NL_Rt_NRtk_K.average_likes
        ),
        sum_average_retweets_negative_NL_Rt_NRtk_K: format_number_pt_br(
          negative_NL_Rt_NRtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_negative_NL_Rt_NRtk_K:
          format_number_pt_br(
            negative_NL_Rt_NRtk_K.average_retweets_with_comments
          ),
        sum_average_comments_negative_NL_Rt_NRtk_K: format_number_pt_br(
          negative_NL_Rt_NRtk_K.average_comments
        ),
        sumMaxLikesNegative_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_negative_max_value.maxComments,
        sumAverageOfAverageNegative_NL_Rt_NRtk_K: format_number_pt_br(
          negative_NL_Rt_NRtk_K.averageOfAverage
        ),
        sumMobEfetiveNegative_NL_Rt_NRtk_K: format_number_pt_br(
          negative_NL_Rt_NRtk_K.mobEfetive
        ),
        sum_freq_negative_L_NRt_NRtk_K: format_number_pt_br(
          negative_L_NRt_NRtk_K.freq
        ),
        sum_average_likes_negative_L_NRt_NRtk_K: format_number_pt_br(
          negative_L_NRt_NRtk_K.average_likes
        ),
        sum_average_retweets_negative_L_NRt_NRtk_K: format_number_pt_br(
          negative_L_NRt_NRtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_negative_L_NRt_NRtk_K:
          format_number_pt_br(
            negative_L_NRt_NRtk_K.average_retweets_with_comments
          ),
        sum_average_comments_negative_L_NRt_NRtk_K: format_number_pt_br(
          negative_L_NRt_NRtk_K.average_comments
        ),
        sumMaxLikesNegative_L_NRt_NRtk_K:
          L_NRt_NRtk_K_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_L_NRt_NRtk_K:
          L_NRt_NRtk_K_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_L_NRt_NRtk_K:
          L_NRt_NRtk_K_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_L_NRt_NRtk_K:
          L_NRt_NRtk_K_negative_max_value.maxComments,
        sumAverageOfAverageNegative_L_NRt_NRtk_K: format_number_pt_br(
          negative_L_NRt_NRtk_K.averageOfAverage
        ),
        sumMobEfetiveNegative_L_NRt_NRtk_K: format_number_pt_br(
          negative_L_NRt_NRtk_K.mobEfetive
        ),
        sum_freq_negative_NL_Rt_Rtk_NK: format_number_pt_br(
          negative_NL_Rt_Rtk_NK.freq
        ),
        sum_average_likes_negative_NL_Rt_Rtk_NK: format_number_pt_br(
          negative_NL_Rt_Rtk_NK.average_likes
        ),
        sum_average_retweets_negative_NL_Rt_Rtk_NK: format_number_pt_br(
          negative_NL_Rt_Rtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_negative_NL_Rt_Rtk_NK:
          format_number_pt_br(
            negative_NL_Rt_Rtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_negative_NL_Rt_Rtk_NK: format_number_pt_br(
          negative_NL_Rt_Rtk_NK.average_comments
        ),
        sumMaxLikesNegative_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_negative_max_value.maxComments,
        sumAverageOfAverageNegative_NL_Rt_Rtk_NK: format_number_pt_br(
          negative_NL_Rt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetiveNegative_NL_Rt_Rtk_NK: format_number_pt_br(
          negative_NL_Rt_Rtk_NK.mobEfetive
        ),
        sum_freq_negative_L_NRt_Rtk_NK: format_number_pt_br(
          negative_L_NRt_Rtk_NK.freq
        ),
        sum_average_likes_negative_L_NRt_Rtk_NK: format_number_pt_br(
          negative_L_NRt_Rtk_NK.average_likes
        ),
        sum_average_retweets_negative_L_NRt_Rtk_NK: format_number_pt_br(
          negative_L_NRt_Rtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_negative_L_NRt_Rtk_NK:
          format_number_pt_br(
            negative_L_NRt_Rtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_negative_L_NRt_Rtk_NK: format_number_pt_br(
          negative_L_NRt_Rtk_NK.average_comments
        ),
        sumMaxLikesNegative_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_negative_max_value.maxComments,
        sumAverageOfAverageNegative_L_NRt_Rtk_NK: format_number_pt_br(
          negative_L_NRt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetiveNegative_L_NRt_Rtk_NK: format_number_pt_br(
          negative_L_NRt_Rtk_NK.mobEfetive
        ),
        sum_freq_negative_L_Rt_NRtk_NK: format_number_pt_br(
          negative_L_Rt_NRtk_NK.freq
        ),
        sum_average_likes_negative_L_Rt_NRtk_NK: format_number_pt_br(
          negative_L_Rt_NRtk_NK.average_likes
        ),
        sum_average_retweets_negative_L_Rt_NRtk_NK: format_number_pt_br(
          negative_L_Rt_NRtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_negative_L_Rt_NRtk_NK:
          format_number_pt_br(
            negative_L_Rt_NRtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_negative_L_Rt_NRtk_NK: format_number_pt_br(
          negative_L_Rt_NRtk_NK.average_comments
        ),
        sumMaxLikesNegative_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_negative_max_value.maxComments,
        sumAverageOfAverageNegative_L_Rt_NRtk_NK: format_number_pt_br(
          negative_L_Rt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetiveNegative_L_Rt_NRtk_NK: format_number_pt_br(
          negative_L_Rt_NRtk_NK.mobEfetive
        ),
        sum_freq_negative_L_Rt_Rtk_NK: format_number_pt_br(
          negative_L_Rt_Rtk_NK.freq
        ),
        sum_average_likes_negative_L_Rt_Rtk_NK: format_number_pt_br(
          negative_L_Rt_Rtk_NK.average_likes
        ),
        sum_average_retweets_negative_L_Rt_Rtk_NK: format_number_pt_br(
          negative_L_Rt_Rtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_negative_L_Rt_Rtk_NK:
          format_number_pt_br(
            negative_L_Rt_Rtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_negative_L_Rt_Rtk_NK: format_number_pt_br(
          negative_L_Rt_Rtk_NK.average_comments
        ),
        sumMaxLikesNegative_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_negative_max_value.maxComments,
        sumAverageOfAverageNegative_L_Rt_Rtk_NK: format_number_pt_br(
          negative_L_Rt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetiveNegative_L_Rt_Rtk_NK: format_number_pt_br(
          negative_L_Rt_Rtk_NK.mobEfetive
        ),
        sum_freq_negative_NL_Rt_Rtk_K: format_number_pt_br(
          negative_NL_Rt_Rtk_K.freq
        ),
        sum_average_likes_negative_NL_Rt_Rtk_K: format_number_pt_br(
          negative_NL_Rt_Rtk_K.average_likes
        ),
        sum_average_retweets_negative_NL_Rt_Rtk_K: format_number_pt_br(
          negative_NL_Rt_Rtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_negative_NL_Rt_Rtk_K:
          format_number_pt_br(
            negative_NL_Rt_Rtk_K.average_retweets_with_comments
          ),
        sum_average_comments_negative_NL_Rt_Rtk_K: format_number_pt_br(
          negative_NL_Rt_Rtk_K.average_comments
        ),
        sumMaxLikesNegative_NL_Rt_Rtk_K: L_Rt_Rtk_K_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_NL_Rt_Rtk_K:
          L_Rt_Rtk_K_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_NL_Rt_Rtk_K:
          L_Rt_Rtk_K_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_NL_Rt_Rtk_K:
          NL_Rt_Rtk_K_negative_max_value.maxComments,
        sumAverageOfAverageNegative_NL_Rt_Rtk_K: format_number_pt_br(
          negative_NL_Rt_Rtk_K.averageOfAverage
        ),
        sumMobEfetiveNegative_NL_Rt_Rtk_K: format_number_pt_br(
          negative_NL_Rt_Rtk_K.mobEfetive
        ),
        sum_freq_negative_L_Rt_NRtk_K: format_number_pt_br(
          negative_L_Rt_NRtk_K.freq
        ),
        sum_average_likes_negative_L_Rt_NRtk_K: format_number_pt_br(
          negative_L_Rt_NRtk_K.average_likes
        ),
        sum_average_retweets_negative_L_Rt_NRtk_K: format_number_pt_br(
          negative_L_Rt_NRtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_negative_L_Rt_NRtk_K:
          format_number_pt_br(
            negative_L_Rt_NRtk_K.average_retweets_with_comments
          ),
        sum_average_comments_negative_L_Rt_NRtk_K: format_number_pt_br(
          negative_L_Rt_NRtk_K.average_comments
        ),
        sumMaxLikesNegative_L_Rt_NRtk_K:
          L_Rt_NRtk_K_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_L_Rt_NRtk_K:
          L_Rt_NRtk_K_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_L_Rt_NRtk_K:
          L_Rt_NRtk_K_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_L_Rt_NRtk_K:
          L_Rt_NRtk_K_negative_max_value.maxComments,
        sumAverageOfAverageNegative_L_Rt_NRtk_K: format_number_pt_br(
          negative_L_Rt_NRtk_K.averageOfAverage
        ),
        sumMobEfetiveNegative_L_Rt_NRtk_K: format_number_pt_br(
          negative_L_Rt_NRtk_K.mobEfetive
        ),
        sum_freq_negative_L_NRt_Rtk_K: format_number_pt_br(
          negative_L_NRt_Rtk_K.freq
        ),
        sum_average_likes_negative_L_NRt_Rtk_K: format_number_pt_br(
          negative_L_NRt_Rtk_K.average_likes
        ),
        sum_average_retweets_negative_L_NRt_Rtk_K: format_number_pt_br(
          negative_L_NRt_Rtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_negative_L_NRt_Rtk_K:
          format_number_pt_br(
            negative_L_NRt_Rtk_K.average_retweets_with_comments
          ),
        sum_average_comments_negative_L_NRt_Rtk_K: format_number_pt_br(
          negative_L_NRt_Rtk_K.average_comments
        ),
        sumMaxLikesNegative_L_NRt_Rtk_K:
          L_NRt_Rtk_K_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_L_NRt_Rtk_K:
          L_NRt_Rtk_K_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_L_NRt_Rtk_K:
          L_NRt_Rtk_K_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_L_NRt_Rtk_K:
          L_NRt_Rtk_K_negative_max_value.maxComments,
        sumAverageOfAverageNegative_L_NRt_Rtk_K: format_number_pt_br(
          negative_L_NRt_Rtk_K.averageOfAverage
        ),
        sumMobEfetiveNegative_L_NRt_Rtk_K: format_number_pt_br(
          negative_L_NRt_Rtk_K.mobEfetive
        ),
        sum_freq_negative_L_Rt_Rtk_K: format_number_pt_br(
          negative_L_Rt_Rtk_K.freq
        ),
        sum_average_likes_negative_L_Rt_Rtk_K: format_number_pt_br(
          negative_L_Rt_Rtk_K.average_likes
        ),
        sum_average_retweets_negative_L_Rt_Rtk_K: format_number_pt_br(
          negative_L_Rt_Rtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_negative_L_Rt_Rtk_K:
          format_number_pt_br(
            negative_L_Rt_Rtk_K.average_retweets_with_comments
          ),
        sum_average_comments_negative_L_Rt_Rtk_K: format_number_pt_br(
          negative_L_Rt_Rtk_K.average_comments
        ),
        sumMaxLikesNegative_L_Rt_Rtk_K: L_Rt_Rtk_K_negative_max_value.maxLikes,
        sumMaxRetweetsNegative_L_Rt_Rtk_K:
          L_Rt_Rtk_K_negative_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsNegative_L_Rt_Rtk_K:
          L_Rt_Rtk_K_negative_max_value.maxRetweetsWithComments,
        sumMaxCommentsNegative_L_Rt_Rtk_K:
          L_Rt_Rtk_K_negative_max_value.maxComments,
        sumAverageOfAverageNegative_L_Rt_Rtk_K: format_number_pt_br(
          negative_L_Rt_Rtk_K.averageOfAverage
        ),
        sumMobEfetiveNegative_L_Rt_Rtk_K: format_number_pt_br(
          negative_L_Rt_Rtk_K.mobEfetive
        ),
        sum_freq_unclassified_NL_NRt_NRtk_NK: format_number_pt_br(
          unclassified_NL_NRt_NRtk_NK.freq
        ),
        sum_average_likes_unclassified_NL_NRt_NRtk_NK: format_number_pt_br(
          unclassified_NL_NRt_NRtk_NK.average_likes
        ),
        sum_average_retweets_unclassified_NL_NRt_NRtk_NK: format_number_pt_br(
          unclassified_NL_NRt_NRtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_NL_NRt_NRtk_NK:
          format_number_pt_br(
            unclassified_NL_NRt_NRtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_NL_NRt_NRtk_NK: format_number_pt_br(
          unclassified_NL_NRt_NRtk_NK.average_comments
        ),
        sumMaxLikesUnclassified_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_NL_NRt_NRtk_NK:
          NL_NRt_NRtk_NK_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_NL_NRt_NRtk_NK: format_number_pt_br(
          unclassified_NL_NRt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetiveUnclassified_NL_NRt_NRtk_NK: format_number_pt_br(
          unclassified_NL_NRt_NRtk_NK.mobEfetive
        ),
        sum_freq_unclassified_NL_NRt_NRtk_K: format_number_pt_br(
          unclassified_NL_NRt_NRtk_K.freq
        ),
        sum_average_likes_unclassified_NL_NRt_NRtk_K: format_number_pt_br(
          unclassified_NL_NRt_NRtk_K.average_likes
        ),
        sum_average_retweets_unclassified_NL_NRt_NRtk_K: format_number_pt_br(
          unclassified_NL_NRt_NRtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_NL_NRt_NRtk_K:
          format_number_pt_br(
            unclassified_NL_NRt_NRtk_K.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_NL_NRt_NRtk_K: format_number_pt_br(
          unclassified_NL_NRt_NRtk_K.average_comments
        ),
        sumMaxLikesUnclassified_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_NL_NRt_NRtk_K:
          NL_NRt_NRtk_K_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_NL_NRt_NRtk_K: format_number_pt_br(
          unclassified_NL_NRt_NRtk_K.averageOfAverage
        ),
        sumMobEfetiveUnclassified_NL_NRt_NRtk_K: format_number_pt_br(
          unclassified_NL_NRt_NRtk_K.mobEfetive
        ),
        sum_freq_unclassified_NL_NRt_Rtk_NK: format_number_pt_br(
          unclassified_NL_NRt_Rtk_NK.freq
        ),
        sum_average_likes_unclassified_NL_NRt_Rtk_NK: format_number_pt_br(
          unclassified_NL_NRt_Rtk_NK.average_likes
        ),
        sum_average_retweets_unclassified_NL_NRt_Rtk_NK: format_number_pt_br(
          unclassified_NL_NRt_Rtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_NL_NRt_Rtk_NK:
          format_number_pt_br(
            unclassified_NL_NRt_Rtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_NL_NRt_Rtk_NK: format_number_pt_br(
          unclassified_NL_NRt_Rtk_NK.average_comments
        ),
        sumMaxLikesUnclassified_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_NL_NRt_Rtk_NK:
          NL_NRt_Rtk_NK_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_NL_NRt_Rtk_NK: format_number_pt_br(
          unclassified_NL_NRt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetiveUnclassified_NL_NRt_Rtk_NK: format_number_pt_br(
          unclassified_NL_NRt_Rtk_NK.mobEfetive
        ),
        sum_freq_unclassified_NL_Rt_NRtk_NK: format_number_pt_br(
          unclassified_NL_Rt_NRtk_NK.freq
        ),
        sum_average_likes_unclassified_NL_Rt_NRtk_NK: format_number_pt_br(
          unclassified_NL_Rt_NRtk_NK.average_likes
        ),
        sum_average_retweets_unclassified_NL_Rt_NRtk_NK: format_number_pt_br(
          unclassified_NL_Rt_NRtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_NL_Rt_NRtk_NK:
          format_number_pt_br(
            unclassified_NL_Rt_NRtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_NL_Rt_NRtk_NK: format_number_pt_br(
          unclassified_NL_Rt_NRtk_NK.average_comments
        ),
        sumMaxLikesUnclassified_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_NL_Rt_NRtk_NK:
          NL_Rt_NRtk_NK_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_NL_Rt_NRtk_NK: format_number_pt_br(
          unclassified_NL_Rt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetiveUnclassified_NL_Rt_NRtk_NK: format_number_pt_br(
          unclassified_NL_Rt_NRtk_NK.mobEfetive
        ),
        sum_freq_unclassified_L_NRt_NRtk_NK: format_number_pt_br(
          unclassified_L_NRt_NRtk_NK.freq
        ),
        sum_average_likes_unclassified_L_NRt_NRtk_NK: format_number_pt_br(
          unclassified_L_NRt_NRtk_NK.average_likes
        ),
        sum_average_retweets_unclassified_L_NRt_NRtk_NK: format_number_pt_br(
          unclassified_L_NRt_NRtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_L_NRt_NRtk_NK:
          format_number_pt_br(
            unclassified_L_NRt_NRtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_L_NRt_NRtk_NK: format_number_pt_br(
          unclassified_L_NRt_NRtk_NK.average_comments
        ),
        sumMaxLikesUnclassified_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_L_NRt_NRtk_NK:
          L_NRt_NRtk_NK_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_L_NRt_NRtk_NK: format_number_pt_br(
          unclassified_L_NRt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetiveUnclassified_L_NRt_NRtk_NK: format_number_pt_br(
          unclassified_L_NRt_NRtk_NK.mobEfetive
        ),
        sum_freq_unclassified_NL_NRt_Rtk_K: format_number_pt_br(
          unclassified_NL_NRt_Rtk_K.freq
        ),
        sum_average_likes_unclassified_NL_NRt_Rtk_K: format_number_pt_br(
          unclassified_NL_NRt_Rtk_K.average_likes
        ),
        sum_average_retweets_unclassified_NL_NRt_Rtk_K: format_number_pt_br(
          unclassified_NL_NRt_Rtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_NL_NRt_Rtk_K:
          format_number_pt_br(
            unclassified_NL_NRt_Rtk_K.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_NL_NRt_Rtk_K: format_number_pt_br(
          unclassified_NL_NRt_Rtk_K.average_comments
        ),
        sumMaxLikesUnclassified_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_NL_NRt_Rtk_K:
          NL_NRt_Rtk_K_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_NL_NRt_Rtk_K: format_number_pt_br(
          unclassified_NL_NRt_Rtk_K.averageOfAverage
        ),
        sumMobEfetiveUnclassified_NL_NRt_Rtk_K: format_number_pt_br(
          unclassified_NL_NRt_Rtk_K.mobEfetive
        ),
        sum_freq_unclassified_NL_Rt_NRtk_K: format_number_pt_br(
          unclassified_NL_Rt_NRtk_K.freq
        ),
        sum_average_likes_unclassified_NL_Rt_NRtk_K: format_number_pt_br(
          unclassified_NL_Rt_NRtk_K.average_likes
        ),
        sum_average_retweets_unclassified_NL_Rt_NRtk_K: format_number_pt_br(
          unclassified_NL_Rt_NRtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_NL_Rt_NRtk_K:
          format_number_pt_br(
            unclassified_NL_Rt_NRtk_K.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_NL_Rt_NRtk_K: format_number_pt_br(
          unclassified_NL_Rt_NRtk_K.average_comments
        ),
        sumMaxLikesUnclassified_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_NL_Rt_NRtk_K:
          NL_Rt_NRtk_K_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_NL_Rt_NRtk_K: format_number_pt_br(
          unclassified_NL_Rt_NRtk_K.averageOfAverage
        ),
        sumMobEfetiveUnclassified_NL_Rt_NRtk_K: format_number_pt_br(
          unclassified_NL_Rt_NRtk_K.mobEfetive
        ),
        sum_freq_unclassified_L_NRt_NRtk_K: format_number_pt_br(
          unclassified_L_NRt_NRtk_K.freq
        ),
        sum_average_likes_unclassified_L_NRt_NRtk_K: format_number_pt_br(
          unclassified_L_NRt_NRtk_K.average_likes
        ),
        sum_average_retweets_unclassified_L_NRt_NRtk_K: format_number_pt_br(
          unclassified_L_NRt_NRtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_L_NRt_NRtk_K:
          format_number_pt_br(
            unclassified_L_NRt_NRtk_K.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_L_NRt_NRtk_K: format_number_pt_br(
          unclassified_L_NRt_NRtk_K.average_comments
        ),
        sumMaxLikesUnclassified_L_NRt_NRtk_K:
          L_NRt_NRtk_K_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_L_NRt_NRtk_K:
          L_NRt_NRtk_K_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_L_NRt_NRtk_K:
          L_NRt_NRtk_K_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_L_NRt_NRtk_K:
          L_NRt_NRtk_K_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_L_NRt_NRtk_K: format_number_pt_br(
          unclassified_L_NRt_NRtk_K.averageOfAverage
        ),
        sumMobEfetiveUnclassified_L_NRt_NRtk_K: format_number_pt_br(
          unclassified_L_NRt_NRtk_K.mobEfetive
        ),
        sum_freq_unclassified_NL_Rt_Rtk_NK: format_number_pt_br(
          unclassified_NL_Rt_Rtk_NK.freq
        ),
        sum_average_likes_unclassified_NL_Rt_Rtk_NK: format_number_pt_br(
          unclassified_NL_Rt_Rtk_NK.average_likes
        ),
        sum_average_retweets_unclassified_NL_Rt_Rtk_NK: format_number_pt_br(
          unclassified_NL_Rt_Rtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_NL_Rt_Rtk_NK:
          format_number_pt_br(
            unclassified_NL_Rt_Rtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_NL_Rt_Rtk_NK: format_number_pt_br(
          unclassified_NL_Rt_Rtk_NK.average_comments
        ),
        sumMaxLikesUnclassified_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_NL_Rt_Rtk_NK:
          NL_Rt_Rtk_NK_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_NL_Rt_Rtk_NK: format_number_pt_br(
          unclassified_NL_Rt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetiveUnclassified_NL_Rt_Rtk_NK: format_number_pt_br(
          unclassified_NL_Rt_Rtk_NK.mobEfetive
        ),
        sum_freq_unclassified_L_NRt_Rtk_NK: format_number_pt_br(
          unclassified_L_NRt_Rtk_NK.freq
        ),
        sum_average_likes_unclassified_L_NRt_Rtk_NK: format_number_pt_br(
          unclassified_L_NRt_Rtk_NK.average_likes
        ),
        sum_average_retweets_unclassified_L_NRt_Rtk_NK: format_number_pt_br(
          unclassified_L_NRt_Rtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_L_NRt_Rtk_NK:
          format_number_pt_br(
            unclassified_L_NRt_Rtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_L_NRt_Rtk_NK: format_number_pt_br(
          unclassified_L_NRt_Rtk_NK.average_comments
        ),
        sumMaxLikesUnclassified_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_L_NRt_Rtk_NK:
          L_NRt_Rtk_NK_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_L_NRt_Rtk_NK: format_number_pt_br(
          unclassified_L_NRt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetiveUnclassified_L_NRt_Rtk_NK: format_number_pt_br(
          unclassified_L_NRt_Rtk_NK.mobEfetive
        ),
        sum_freq_unclassified_L_Rt_NRtk_NK: format_number_pt_br(
          unclassified_L_Rt_NRtk_NK.freq
        ),
        sum_average_likes_unclassified_L_Rt_NRtk_NK: format_number_pt_br(
          unclassified_L_Rt_NRtk_NK.average_likes
        ),
        sum_average_retweets_unclassified_L_Rt_NRtk_NK: format_number_pt_br(
          unclassified_L_Rt_NRtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_L_Rt_NRtk_NK:
          format_number_pt_br(
            unclassified_L_Rt_NRtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_L_Rt_NRtk_NK: format_number_pt_br(
          unclassified_L_Rt_NRtk_NK.average_comments
        ),
        sumMaxLikesUnclassified_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_L_Rt_NRtk_NK:
          L_Rt_NRtk_NK_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_L_Rt_NRtk_NK: format_number_pt_br(
          unclassified_L_Rt_NRtk_NK.averageOfAverage
        ),
        sumMobEfetiveUnclassified_L_Rt_NRtk_NK: format_number_pt_br(
          unclassified_L_Rt_NRtk_NK.mobEfetive
        ),
        sum_freq_unclassified_L_Rt_Rtk_NK: format_number_pt_br(
          unclassified_L_Rt_Rtk_NK.freq
        ),
        sum_average_likes_unclassified_L_Rt_Rtk_NK: format_number_pt_br(
          unclassified_L_Rt_Rtk_NK.average_likes
        ),
        sum_average_retweets_unclassified_L_Rt_Rtk_NK: format_number_pt_br(
          unclassified_L_Rt_Rtk_NK.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_L_Rt_Rtk_NK:
          format_number_pt_br(
            unclassified_L_Rt_Rtk_NK.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_L_Rt_Rtk_NK: format_number_pt_br(
          unclassified_L_Rt_Rtk_NK.average_comments
        ),
        sumMaxLikesUnclassified_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_L_Rt_Rtk_NK:
          L_Rt_Rtk_NK_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_L_Rt_Rtk_NK: format_number_pt_br(
          unclassified_L_Rt_Rtk_NK.averageOfAverage
        ),
        sumMobEfetiveUnclassified_L_Rt_Rtk_NK: format_number_pt_br(
          unclassified_L_Rt_Rtk_NK.mobEfetive
        ),
        sum_freq_unclassified_NL_Rt_Rtk_K: format_number_pt_br(
          unclassified_NL_Rt_Rtk_K.freq
        ),
        sum_average_likes_unclassified_NL_Rt_Rtk_K: format_number_pt_br(
          unclassified_NL_Rt_Rtk_K.average_likes
        ),
        sum_average_retweets_unclassified_NL_Rt_Rtk_K: format_number_pt_br(
          unclassified_NL_Rt_Rtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_NL_Rt_Rtk_K:
          format_number_pt_br(
            unclassified_NL_Rt_Rtk_K.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_NL_Rt_Rtk_K: format_number_pt_br(
          unclassified_NL_Rt_Rtk_K.average_comments
        ),
        sumMaxLikesUnclassified_NL_Rt_Rtk_K:
          NL_Rt_Rtk_K_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_NL_Rt_Rtk_K:
          NL_Rt_Rtk_K_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_NL_Rt_Rtk_K:
          NL_Rt_Rtk_K_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_NL_Rt_Rtk_K:
          NL_Rt_Rtk_K_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_NL_Rt_Rtk_K:
          unclassified_NL_Rt_Rtk_K.averageOfAverage,
        sumMobEfetiveUnclassified_NL_Rt_Rtk_K: format_number_pt_br(
          unclassified_NL_Rt_Rtk_K.mobEfetive
        ),
        sum_freq_unclassified_L_Rt_NRtk_K: format_number_pt_br(
          unclassified_L_Rt_NRtk_K.freq
        ),
        sum_average_likes_unclassified_L_Rt_NRtk_K: format_number_pt_br(
          unclassified_L_Rt_NRtk_K.average_likes
        ),
        sum_average_retweets_unclassified_L_Rt_NRtk_K: format_number_pt_br(
          unclassified_L_Rt_NRtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_L_Rt_NRtk_K:
          format_number_pt_br(
            unclassified_L_Rt_NRtk_K.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_L_Rt_NRtk_K: format_number_pt_br(
          unclassified_L_Rt_NRtk_K.average_comments
        ),
        sumMaxLikesUnclassified_L_Rt_NRtk_K:
          L_Rt_NRtk_K_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_L_Rt_NRtk_K:
          L_Rt_NRtk_K_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_L_Rt_NRtk_K:
          L_Rt_NRtk_K_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_L_Rt_NRtk_K:
          L_Rt_NRtk_K_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_L_Rt_NRtk_K: format_number_pt_br(
          unclassified_L_Rt_NRtk_K.averageOfAverage
        ),
        sumMobEfetiveUnclassified_L_Rt_NRtk_K: format_number_pt_br(
          unclassified_L_Rt_NRtk_K.mobEfetive
        ),
        sum_freq_unclassified_L_NRt_Rtk_K: format_number_pt_br(
          unclassified_L_NRt_Rtk_K.freq
        ),
        sum_average_likes_unclassified_L_NRt_Rtk_K: format_number_pt_br(
          unclassified_L_NRt_Rtk_K.average_likes
        ),
        sum_average_retweets_unclassified_L_NRt_Rtk_K: format_number_pt_br(
          unclassified_L_NRt_Rtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_L_NRt_Rtk_K:
          format_number_pt_br(
            unclassified_L_NRt_Rtk_K.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_L_NRt_Rtk_K: format_number_pt_br(
          unclassified_L_NRt_Rtk_K.average_comments
        ),
        sumMaxLikesUnclassified_L_NRt_Rtk_K:
          L_NRt_Rtk_K_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_L_NRt_Rtk_K:
          L_NRt_Rtk_K_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_L_NRt_Rtk_K:
          L_NRt_Rtk_K_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_L_NRt_Rtk_K:
          L_NRt_Rtk_K_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_L_NRt_Rtk_K: format_number_pt_br(
          unclassified_L_NRt_Rtk_K.averageOfAverage
        ),
        sumMobEfetiveUnclassified_L_NRt_Rtk_K: format_number_pt_br(
          unclassified_L_NRt_Rtk_K.mobEfetive
        ),
        sum_freq_unclassified_L_Rt_Rtk_K: format_number_pt_br(
          unclassified_L_Rt_Rtk_K.freq
        ),
        sum_average_likes_unclassified_L_Rt_Rtk_K: format_number_pt_br(
          unclassified_L_Rt_Rtk_K.average_likes
        ),
        sum_average_retweets_unclassified_L_Rt_Rtk_K: format_number_pt_br(
          unclassified_L_Rt_Rtk_K.average_retweets
        ),
        sum_average_retweets_with_comments_unclassified_L_Rt_Rtk_K:
          format_number_pt_br(
            unclassified_L_Rt_Rtk_K.average_retweets_with_comments
          ),
        sum_average_comments_unclassified_L_Rt_Rtk_K: format_number_pt_br(
          unclassified_L_Rt_Rtk_K.average_comments
        ),
        sumMaxLikesUnclassified_L_Rt_Rtk_K:
          L_Rt_Rtk_K_nclass_max_value.maxLikes,
        sumMaxRetweetsUnclassified_L_Rt_Rtk_K:
          L_Rt_Rtk_K_nclass_max_value.maxRetweets,
        sumMaxRetweetsWithCommentsUnclassified_L_Rt_Rtk_K:
          L_Rt_Rtk_K_nclass_max_value.maxRetweetsWithComments,
        sumMaxCommentsUnclassified_L_Rt_Rtk_K:
          L_Rt_Rtk_K_nclass_max_value.maxComments,
        sumAverageOfAverageUnclassified_L_Rt_Rtk_K: format_number_pt_br(
          unclassified_L_Rt_Rtk_K.averageOfAverage
        ),
        sumMobEfetiveUnclassified_L_Rt_Rtk_K: format_number_pt_br(
          unclassified_L_Rt_Rtk_K.mobEfetive
        ),
        sum_freq_positive: format_number_pt_br(
          (
            positive_NL_NRt_NRtk_NK.freq +
            positive_NL_NRt_NRtk_K.freq +
            positive_NL_NRt_Rtk_NK.freq +
            positive_NL_Rt_NRtk_NK.freq +
            positive_L_NRt_NRtk_NK.freq +
            positive_NL_NRt_Rtk_K.freq +
            positive_NL_Rt_NRtk_K.freq +
            positive_L_NRt_NRtk_K.freq +
            positive_NL_Rt_Rtk_NK.freq +
            positive_L_NRt_Rtk_NK.freq +
            positive_L_Rt_NRtk_NK.freq +
            positive_L_Rt_Rtk_NK.freq +
            positive_NL_Rt_Rtk_K.freq +
            positive_L_Rt_NRtk_K.freq +
            positive_L_NRt_Rtk_K.freq +
            positive_L_Rt_Rtk_K.freq
          ).toFixed(2)
        ),
        sum_average_likes_positive: format_number_pt_br(
          (
            positive_NL_NRt_NRtk_NK.average_likes +
            positive_NL_NRt_NRtk_K.average_likes +
            positive_NL_NRt_Rtk_NK.average_likes +
            positive_NL_Rt_NRtk_NK.average_likes +
            positive_L_NRt_NRtk_NK.average_likes +
            positive_NL_NRt_Rtk_K.average_likes +
            positive_NL_Rt_NRtk_K.average_likes +
            positive_L_NRt_NRtk_K.average_likes +
            positive_NL_Rt_Rtk_NK.average_likes +
            positive_L_NRt_Rtk_NK.average_likes +
            positive_L_Rt_NRtk_NK.average_likes +
            positive_L_Rt_Rtk_NK.average_likes +
            positive_NL_Rt_Rtk_K.average_likes +
            positive_L_Rt_NRtk_K.average_likes +
            positive_L_NRt_Rtk_K.average_likes +
            positive_L_Rt_Rtk_K.average_likes
          ).toFixed(2)
        ),
        sum_average_retweets_positive: format_number_pt_br(
          (
            positive_NL_NRt_NRtk_NK.average_retweets +
            positive_NL_NRt_NRtk_K.average_retweets +
            positive_NL_NRt_Rtk_NK.average_retweets +
            positive_NL_Rt_NRtk_NK.average_retweets +
            positive_L_NRt_NRtk_NK.average_retweets +
            positive_NL_NRt_Rtk_K.average_retweets +
            positive_NL_Rt_NRtk_K.average_retweets +
            positive_L_NRt_NRtk_K.average_retweets +
            positive_NL_Rt_Rtk_NK.average_retweets +
            positive_L_NRt_Rtk_NK.average_retweets +
            positive_L_Rt_NRtk_NK.average_retweets +
            positive_L_Rt_Rtk_NK.average_retweets +
            positive_NL_Rt_Rtk_K.average_retweets +
            positive_L_Rt_NRtk_K.average_retweets +
            positive_L_NRt_Rtk_K.average_retweets +
            positive_L_Rt_Rtk_K.average_retweets
          ).toFixed(2)
        ),
        sum_average_retweets_with_comments_positive: format_number_pt_br(
          (
            positive_NL_NRt_NRtk_NK.average_retweets_with_comments +
            positive_NL_NRt_NRtk_K.average_retweets_with_comments +
            positive_NL_NRt_Rtk_NK.average_retweets_with_comments +
            positive_NL_Rt_NRtk_NK.average_retweets_with_comments +
            positive_L_NRt_NRtk_NK.average_retweets_with_comments +
            positive_NL_NRt_Rtk_K.average_retweets_with_comments +
            positive_NL_Rt_NRtk_K.average_retweets_with_comments +
            positive_L_NRt_NRtk_K.average_retweets_with_comments +
            positive_NL_Rt_Rtk_NK.average_retweets_with_comments +
            positive_L_NRt_Rtk_NK.average_retweets_with_comments +
            positive_L_Rt_NRtk_NK.average_retweets_with_comments +
            positive_L_Rt_Rtk_NK.average_retweets_with_comments +
            positive_NL_Rt_Rtk_K.average_retweets_with_comments +
            positive_L_Rt_NRtk_K.average_retweets_with_comments +
            positive_L_NRt_Rtk_K.average_retweets_with_comments +
            positive_L_Rt_Rtk_K.average_retweets_with_comments
          ).toFixed(2)
        ),
        sum_average_comments_positive: format_number_pt_br(
          (
            positive_NL_NRt_NRtk_NK.average_comments +
            positive_NL_NRt_NRtk_K.average_comments +
            positive_NL_NRt_Rtk_NK.average_comments +
            positive_NL_Rt_NRtk_NK.average_comments +
            positive_L_NRt_NRtk_NK.average_comments +
            positive_NL_NRt_Rtk_K.average_comments +
            positive_NL_Rt_NRtk_K.average_comments +
            positive_L_NRt_NRtk_K.average_comments +
            positive_NL_Rt_Rtk_NK.average_comments +
            positive_L_NRt_Rtk_NK.average_comments +
            positive_L_Rt_NRtk_NK.average_comments +
            positive_L_Rt_Rtk_NK.average_comments +
            positive_NL_Rt_Rtk_K.average_comments +
            positive_L_Rt_NRtk_K.average_comments +
            positive_L_NRt_Rtk_K.average_comments +
            positive_L_Rt_Rtk_K.average_comments
          ).toFixed(2)
        ),
        sum_freq_neutral: format_number_pt_br(
          (
            neutral_NL_NRt_NRtk_NK.freq +
            neutral_NL_NRt_NRtk_K.freq +
            neutral_NL_NRt_Rtk_NK.freq +
            neutral_NL_Rt_NRtk_NK.freq +
            neutral_L_NRt_NRtk_NK.freq +
            neutral_NL_NRt_Rtk_K.freq +
            neutral_NL_Rt_NRtk_K.freq +
            neutral_L_NRt_NRtk_K.freq +
            neutral_NL_Rt_Rtk_NK.freq +
            neutral_L_NRt_Rtk_NK.freq +
            neutral_L_Rt_NRtk_NK.freq +
            neutral_L_Rt_Rtk_NK.freq +
            neutral_NL_Rt_Rtk_K.freq +
            neutral_L_Rt_NRtk_K.freq +
            neutral_L_NRt_Rtk_K.freq +
            neutral_L_Rt_Rtk_K.freq
          ).toFixed(2)
        ),
        sum_average_likes_neutral: format_number_pt_br(
          (
            neutral_NL_NRt_NRtk_NK.average_likes +
            neutral_NL_NRt_NRtk_K.average_likes +
            neutral_NL_NRt_Rtk_NK.average_likes +
            neutral_NL_Rt_NRtk_NK.average_likes +
            neutral_L_NRt_NRtk_NK.average_likes +
            neutral_NL_NRt_Rtk_K.average_likes +
            neutral_NL_Rt_NRtk_K.average_likes +
            neutral_L_NRt_NRtk_K.average_likes +
            neutral_NL_Rt_Rtk_NK.average_likes +
            neutral_L_NRt_Rtk_NK.average_likes +
            neutral_L_Rt_NRtk_NK.average_likes +
            neutral_L_Rt_Rtk_NK.average_likes +
            neutral_NL_Rt_Rtk_K.average_likes +
            neutral_L_Rt_NRtk_K.average_likes +
            neutral_L_NRt_Rtk_K.average_likes +
            neutral_L_Rt_Rtk_K.average_likes
          ).toFixed(2)
        ),
        sum_average_retweets_neutral: format_number_pt_br(
          (
            neutral_NL_NRt_NRtk_NK.average_retweets +
            neutral_NL_NRt_NRtk_K.average_retweets +
            neutral_NL_NRt_Rtk_NK.average_retweets +
            neutral_NL_Rt_NRtk_NK.average_retweets +
            neutral_L_NRt_NRtk_NK.average_retweets +
            neutral_NL_NRt_Rtk_K.average_retweets +
            neutral_NL_Rt_NRtk_K.average_retweets +
            neutral_L_NRt_NRtk_K.average_retweets +
            neutral_NL_Rt_Rtk_NK.average_retweets +
            neutral_L_NRt_Rtk_NK.average_retweets +
            neutral_L_Rt_NRtk_NK.average_retweets +
            neutral_L_Rt_Rtk_NK.average_retweets +
            neutral_NL_Rt_Rtk_K.average_retweets +
            neutral_L_Rt_NRtk_K.average_retweets +
            neutral_L_NRt_Rtk_K.average_retweets +
            neutral_L_Rt_Rtk_K.average_retweets
          ).toFixed(2)
        ),
        sum_average_retweets_with_comments_neutral: format_number_pt_br(
          (
            neutral_NL_NRt_NRtk_NK.average_retweets_with_comments +
            neutral_NL_NRt_NRtk_K.average_retweets_with_comments +
            neutral_NL_NRt_Rtk_NK.average_retweets_with_comments +
            neutral_NL_Rt_NRtk_NK.average_retweets_with_comments +
            neutral_L_NRt_NRtk_NK.average_retweets_with_comments +
            neutral_NL_NRt_Rtk_K.average_retweets_with_comments +
            neutral_NL_Rt_NRtk_K.average_retweets_with_comments +
            neutral_L_NRt_NRtk_K.average_retweets_with_comments +
            neutral_NL_Rt_Rtk_NK.average_retweets_with_comments +
            neutral_L_NRt_Rtk_NK.average_retweets_with_comments +
            neutral_L_Rt_NRtk_NK.average_retweets_with_comments +
            neutral_L_Rt_Rtk_NK.average_retweets_with_comments +
            neutral_NL_Rt_Rtk_K.average_retweets_with_comments +
            neutral_L_Rt_NRtk_K.average_retweets_with_comments +
            neutral_L_NRt_Rtk_K.average_retweets_with_comments +
            neutral_L_Rt_Rtk_K.average_retweets_with_comments
          ).toFixed(2)
        ),
        sum_average_comments_neutral: format_number_pt_br(
          (
            neutral_NL_NRt_NRtk_NK.average_comments +
            neutral_NL_NRt_NRtk_K.average_comments +
            neutral_NL_NRt_Rtk_NK.average_comments +
            neutral_NL_Rt_NRtk_NK.average_comments +
            neutral_L_NRt_NRtk_NK.average_comments +
            neutral_NL_NRt_Rtk_K.average_comments +
            neutral_NL_Rt_NRtk_K.average_comments +
            neutral_L_NRt_NRtk_K.average_comments +
            neutral_NL_Rt_Rtk_NK.average_comments +
            neutral_L_NRt_Rtk_NK.average_comments +
            neutral_L_Rt_NRtk_NK.average_comments +
            neutral_L_Rt_Rtk_NK.average_comments +
            neutral_NL_Rt_Rtk_K.average_comments +
            neutral_L_Rt_NRtk_K.average_comments +
            neutral_L_NRt_Rtk_K.average_comments +
            neutral_L_Rt_Rtk_K.average_comments
          ).toFixed(2)
        ),
        sum_freq_negative: format_number_pt_br(
          (
            negative_NL_NRt_NRtk_NK.freq +
            negative_NL_NRt_NRtk_K.freq +
            negative_NL_NRt_Rtk_NK.freq +
            negative_NL_Rt_NRtk_NK.freq +
            negative_L_NRt_NRtk_NK.freq +
            negative_NL_NRt_Rtk_K.freq +
            negative_NL_Rt_NRtk_K.freq +
            negative_L_NRt_NRtk_K.freq +
            negative_NL_Rt_Rtk_NK.freq +
            negative_L_NRt_Rtk_NK.freq +
            negative_L_Rt_NRtk_NK.freq +
            negative_L_Rt_Rtk_NK.freq +
            negative_NL_Rt_Rtk_K.freq +
            negative_L_Rt_NRtk_K.freq +
            negative_L_NRt_Rtk_K.freq +
            negative_L_Rt_Rtk_K.freq
          ).toFixed(2)
        ),
        sum_average_likes_negative: format_number_pt_br(
          (
            negative_NL_NRt_NRtk_NK.average_likes +
            negative_NL_NRt_NRtk_K.average_likes +
            negative_NL_NRt_Rtk_NK.average_likes +
            negative_NL_Rt_NRtk_NK.average_likes +
            negative_L_NRt_NRtk_NK.average_likes +
            negative_NL_NRt_Rtk_K.average_likes +
            negative_NL_Rt_NRtk_K.average_likes +
            negative_L_NRt_NRtk_K.average_likes +
            negative_NL_Rt_Rtk_NK.average_likes +
            negative_L_NRt_Rtk_NK.average_likes +
            negative_L_Rt_NRtk_NK.average_likes +
            negative_L_Rt_Rtk_NK.average_likes +
            negative_NL_Rt_Rtk_K.average_likes +
            negative_L_Rt_NRtk_K.average_likes +
            negative_L_NRt_Rtk_K.average_likes +
            negative_L_Rt_Rtk_K.average_likes
          ).toFixed(2)
        ),
        sum_average_retweets_negative: format_number_pt_br(
          (
            negative_NL_NRt_NRtk_NK.average_retweets +
            negative_NL_NRt_NRtk_K.average_retweets +
            negative_NL_NRt_Rtk_NK.average_retweets +
            negative_NL_Rt_NRtk_NK.average_retweets +
            negative_L_NRt_NRtk_NK.average_retweets +
            negative_NL_NRt_Rtk_K.average_retweets +
            negative_NL_Rt_NRtk_K.average_retweets +
            negative_L_NRt_NRtk_K.average_retweets +
            negative_NL_Rt_Rtk_NK.average_retweets +
            negative_L_NRt_Rtk_NK.average_retweets +
            negative_L_Rt_NRtk_NK.average_retweets +
            negative_L_Rt_Rtk_NK.average_retweets +
            negative_NL_Rt_Rtk_K.average_retweets +
            negative_L_Rt_NRtk_K.average_retweets +
            negative_L_NRt_Rtk_K.average_retweets +
            negative_L_Rt_Rtk_K.average_retweets
          ).toFixed(2)
        ),
        sum_average_retweets_with_comments_negative: format_number_pt_br(
          (
            negative_NL_NRt_NRtk_NK.average_retweets_with_comments +
            negative_NL_NRt_NRtk_K.average_retweets_with_comments +
            negative_NL_NRt_Rtk_NK.average_retweets_with_comments +
            negative_NL_Rt_NRtk_NK.average_retweets_with_comments +
            negative_L_NRt_NRtk_NK.average_retweets_with_comments +
            negative_NL_NRt_Rtk_K.average_retweets_with_comments +
            negative_NL_Rt_NRtk_K.average_retweets_with_comments +
            negative_L_NRt_NRtk_K.average_retweets_with_comments +
            negative_NL_Rt_Rtk_NK.average_retweets_with_comments +
            negative_L_NRt_Rtk_NK.average_retweets_with_comments +
            negative_L_Rt_NRtk_NK.average_retweets_with_comments +
            negative_L_Rt_Rtk_NK.average_retweets_with_comments +
            negative_NL_Rt_Rtk_K.average_retweets_with_comments +
            negative_L_Rt_NRtk_K.average_retweets_with_comments +
            negative_L_NRt_Rtk_K.average_retweets_with_comments +
            negative_L_Rt_Rtk_K.average_retweets_with_comments
          ).toFixed(2)
        ),
        sum_average_comments_negative: format_number_pt_br(
          (
            negative_NL_NRt_NRtk_NK.average_comments +
            negative_NL_NRt_NRtk_K.average_comments +
            negative_NL_NRt_Rtk_NK.average_comments +
            negative_NL_Rt_NRtk_NK.average_comments +
            negative_L_NRt_NRtk_NK.average_comments +
            negative_NL_NRt_Rtk_K.average_comments +
            negative_NL_Rt_NRtk_K.average_comments +
            negative_L_NRt_NRtk_K.average_comments +
            negative_NL_Rt_Rtk_NK.average_comments +
            negative_L_NRt_Rtk_NK.average_comments +
            negative_L_Rt_NRtk_NK.average_comments +
            negative_L_Rt_Rtk_NK.average_comments +
            negative_NL_Rt_Rtk_K.average_comments +
            negative_L_Rt_NRtk_K.average_comments +
            negative_L_NRt_Rtk_K.average_comments +
            negative_L_Rt_Rtk_K.average_comments
          ).toFixed(2)
        ),
        sum_freq_unclassified: format_number_pt_br(
          (
            unclassified_NL_NRt_NRtk_NK.freq +
            unclassified_NL_NRt_NRtk_K.freq +
            unclassified_NL_NRt_Rtk_NK.freq +
            unclassified_NL_Rt_NRtk_NK.freq +
            unclassified_L_NRt_NRtk_NK.freq +
            unclassified_NL_NRt_Rtk_K.freq +
            unclassified_NL_Rt_NRtk_K.freq +
            unclassified_L_NRt_NRtk_K.freq +
            unclassified_NL_Rt_Rtk_NK.freq +
            unclassified_L_NRt_Rtk_NK.freq +
            unclassified_L_Rt_NRtk_NK.freq +
            unclassified_L_Rt_Rtk_NK.freq +
            unclassified_NL_Rt_Rtk_K.freq +
            unclassified_L_Rt_NRtk_K.freq +
            unclassified_L_NRt_Rtk_K.freq +
            unclassified_L_Rt_Rtk_K.freq
          ).toFixed(2)
        ),
        sum_average_likes_unclassified: format_number_pt_br(
          (
            unclassified_NL_NRt_NRtk_NK.average_likes +
            unclassified_NL_NRt_NRtk_K.average_likes +
            unclassified_NL_NRt_Rtk_NK.average_likes +
            unclassified_NL_Rt_NRtk_NK.average_likes +
            unclassified_L_NRt_NRtk_NK.average_likes +
            unclassified_NL_NRt_Rtk_K.average_likes +
            unclassified_NL_Rt_NRtk_K.average_likes +
            unclassified_L_NRt_NRtk_K.average_likes +
            unclassified_NL_Rt_Rtk_NK.average_likes +
            unclassified_L_NRt_Rtk_NK.average_likes +
            unclassified_L_Rt_NRtk_NK.average_likes +
            unclassified_L_Rt_Rtk_NK.average_likes +
            unclassified_NL_Rt_Rtk_K.average_likes +
            unclassified_L_Rt_NRtk_K.average_likes +
            unclassified_L_NRt_Rtk_K.average_likes +
            unclassified_L_Rt_Rtk_K.average_likes
          ).toFixed(2)
        ),
        sum_average_retweets_unclassified: format_number_pt_br(
          (
            unclassified_NL_NRt_NRtk_NK.average_retweets +
            unclassified_NL_NRt_NRtk_K.average_retweets +
            unclassified_NL_NRt_Rtk_NK.average_retweets +
            unclassified_NL_Rt_NRtk_NK.average_retweets +
            unclassified_L_NRt_NRtk_NK.average_retweets +
            unclassified_NL_NRt_Rtk_K.average_retweets +
            unclassified_NL_Rt_NRtk_K.average_retweets +
            unclassified_L_NRt_NRtk_K.average_retweets +
            unclassified_NL_Rt_Rtk_NK.average_retweets +
            unclassified_L_NRt_Rtk_NK.average_retweets +
            unclassified_L_Rt_NRtk_NK.average_retweets +
            unclassified_L_Rt_Rtk_NK.average_retweets +
            unclassified_NL_Rt_Rtk_K.average_retweets +
            unclassified_L_Rt_NRtk_K.average_retweets +
            unclassified_L_NRt_Rtk_K.average_retweets +
            unclassified_L_Rt_Rtk_K.average_retweets
          ).toFixed(2)
        ),
        sum_average_retweets_with_comments_unclassified: format_number_pt_br(
          (
            unclassified_NL_NRt_NRtk_NK.average_retweets_with_comments +
            unclassified_NL_NRt_NRtk_K.average_retweets_with_comments +
            unclassified_NL_NRt_Rtk_NK.average_retweets_with_comments +
            unclassified_NL_Rt_NRtk_NK.average_retweets_with_comments +
            unclassified_L_NRt_NRtk_NK.average_retweets_with_comments +
            unclassified_NL_NRt_Rtk_K.average_retweets_with_comments +
            unclassified_NL_Rt_NRtk_K.average_retweets_with_comments +
            unclassified_L_NRt_NRtk_K.average_retweets_with_comments +
            unclassified_NL_Rt_Rtk_NK.average_retweets_with_comments +
            unclassified_L_NRt_Rtk_NK.average_retweets_with_comments +
            unclassified_L_Rt_NRtk_NK.average_retweets_with_comments +
            unclassified_L_Rt_Rtk_NK.average_retweets_with_comments +
            unclassified_NL_Rt_Rtk_K.average_retweets_with_comments +
            unclassified_L_Rt_NRtk_K.average_retweets_with_comments +
            unclassified_L_NRt_Rtk_K.average_retweets_with_comments +
            unclassified_L_Rt_Rtk_K.average_retweets_with_comments
          ).toFixed(2)
        ),
        sum_average_comments_unclassified: format_number_pt_br(
          (
            unclassified_NL_NRt_NRtk_NK.average_comments +
            unclassified_NL_NRt_NRtk_K.average_comments +
            unclassified_NL_NRt_Rtk_NK.average_comments +
            unclassified_NL_Rt_NRtk_NK.average_comments +
            unclassified_L_NRt_NRtk_NK.average_comments +
            unclassified_NL_NRt_Rtk_K.average_comments +
            unclassified_NL_Rt_NRtk_K.average_comments +
            unclassified_L_NRt_NRtk_K.average_comments +
            unclassified_NL_Rt_Rtk_NK.average_comments +
            unclassified_L_NRt_Rtk_NK.average_comments +
            unclassified_L_Rt_NRtk_NK.average_comments +
            unclassified_L_Rt_Rtk_NK.average_comments +
            unclassified_NL_Rt_Rtk_K.average_comments +
            unclassified_L_Rt_NRtk_K.average_comments +
            unclassified_L_NRt_Rtk_K.average_comments +
            unclassified_L_Rt_Rtk_K.average_comments
          ).toFixed(2)
        ),
        profileId: collect.profileId,
        numCollectedTweets: format_number_pt_br(collect.totalTweets),
        followers: format_number_pt_br(followers_count),
        sumCapitalSocialBourdiesian,
        sumCapitalSocialBourdiesianPositive,
        sumCapitalSocialBourdiesianNeutral,
        sumCapitalSocialBourdiesianNegative,
        sumCapitalSocialBourdiesianNonClass,
        sumGspAverageOfAverage: format_number_pt_br(sumGspAverageOfAverage),
        averageOfAverageNL_NRt_NRtk_NK: format_number_pt_br(
          NL_NRt_NRtk_NK.averageOfAverage
        ),
        averageOfAverageNL_NRt_NRtk_K: format_number_pt_br(
          NL_NRt_NRtk_K.averageOfAverage
        ),
        averageOfAverageNL_NRt_Rtk_NK: format_number_pt_br(
          NL_NRt_Rtk_NK.averageOfAverage
        ),
        averageOfAverageNL_Rt_NRtk_NK: format_number_pt_br(
          NL_Rt_NRtk_NK.averageOfAverage
        ),
        averageOfAverageL_NRt_NRtk_NK: format_number_pt_br(
          L_NRt_NRtk_NK.averageOfAverage
        ),
        averageOfAverageNL_NRt_Rtk_K: format_number_pt_br(
          NL_NRt_Rtk_K.averageOfAverage
        ),
        averageOfAverageNL_Rt_NRtk_K: format_number_pt_br(
          NL_Rt_NRtk_K.averageOfAverage
        ),
        averageOfAverageL_NRt_NRtk_K: format_number_pt_br(
          L_NRt_NRtk_K.averageOfAverage
        ),
        averageOfAverageNL_Rt_Rtk_NK: format_number_pt_br(
          NL_Rt_Rtk_NK.averageOfAverage
        ),
        averageOfAverageL_NRt_Rtk_NK: format_number_pt_br(
          L_NRt_Rtk_NK.averageOfAverage
        ),
        averageOfAverageL_Rt_NRtk_NK: format_number_pt_br(
          L_Rt_NRtk_NK.averageOfAverage
        ),
        averageOfAverageL_Rt_Rtk_NK: format_number_pt_br(
          L_Rt_Rtk_NK.averageOfAverage
        ),
        averageOfAverageNL_Rt_Rtk_K: format_number_pt_br(
          NL_Rt_Rtk_K.averageOfAverage
        ),
        averageOfAverageL_Rt_NRtk_K: format_number_pt_br(
          L_Rt_NRtk_K.averageOfAverage
        ),
        averageOfAverageL_NRt_Rtk_K: format_number_pt_br(
          L_NRt_Rtk_K.averageOfAverage
        ),
        averageOfAverageL_Rt_Rtk_K: format_number_pt_br(
          L_Rt_Rtk_K.averageOfAverage
        ),
        positiveMaxLikes: max_value_positive.maxLikes,
        positiveMaxRetweets: max_value_positive.maxRetweets,
        positiveMaxRetweetsWithComments:
          max_value_positive.maxRetweetsWithComments,
        positiveMaxComments: max_value_positive.maxComments,
        positiveAverageOfAverage: format_number_pt_br(
          positive_report.averageOfAverage
        ),
        positiveMobEfetive: format_number_pt_br(positive_report.mobEfetive),
        neutralMaxLikes: max_value_neutral.maxLikes,
        neutralMaxRetweets: max_value_neutral.maxRetweets,
        neutralMaxRetweetsWithComments:
          max_value_neutral.maxRetweetsWithComments,
        neutralMaxComments: max_value_neutral.maxComments,
        neutralAverageOfAverage: format_number_pt_br(
          neutral_report.averageOfAverage
        ),
        neutralMobEfetive: format_number_pt_br(neutral_report.mobEfetive),
        negativeMaxLikes: max_value_negative.maxLikes,
        negativeMaxRetweets: max_value_negative.maxRetweets,
        negativeMaxRetweetsWithComments:
          max_value_negative.maxRetweetsWithComments,
        negativeMaxComments: max_value_negative.maxComments,
        negativeAverageOfAverage: format_number_pt_br(
          negative_report.averageOfAverage
        ),
        negativeMobEfetive: format_number_pt_br(negative_report.mobEfetive),
        unclassifiedMaxLikes: max_value_nclass.maxLikes,
        unclassifiedMaxRetweets: max_value_nclass.maxRetweets,
        unclassifiedMaxRetweetsWithComments:
          max_value_nclass.maxRetweetsWithComments,
        unclassifiedMaxComments: max_value_nclass.maxComments,
        unclassifiedAverageOfAverage: format_number_pt_br(
          unclassified_report.averageOfAverage
        ),
        unclassifiedMobEfetive: format_number_pt_br(
          unclassified_report.mobEfetive
        ),
        sumMaxLikes: sum_reports.sumMaxLikes,
        sumMaxRetweets: sum_reports.sumMaxRetweets,
        sumMaxRetweetsWithComments: sum_reports.sumMaxRetweetsWithComments,
        sumMaxComments: sum_reports.sumMaxComments,
        sumAverageOfAverage: sum_reports.sumAverageOfAverage,
        sumMobEfetive: sum_reports.sumMobEfetive,
        sumMaxLikesPositive: sum_reports.sumPositiveMaxLikes,
        sumMaxRetweetsPositive: sum_reports.sumPositiveMaxRetweets,
        sumMaxRetweetsWithCommentsPositive:
          sum_reports.sumPositiveMaxRetweetsWithComments,
        sumMaxCommentsPositive: sum_reports.sumPositiveMaxComments,
        sumAverageOfAveragePositive: sum_averageOfAverage_positive,
        sumMobEfetivePositive: sum_mobEfetive_positive,
        sumMaxLikesNeutral: sum_reports.sumNeutralMaxLikes,
        sumMaxRetweetsNeutral: sum_reports.sumNeutralMaxRetweets,
        sumMaxRetweetsWithCommentsNeutral:
          sum_reports.sumNeutralMaxRetweetsWithComments,
        sumMaxCommentsNeutral: sum_reports.sumNeutralMaxComments,
        sumAverageOfAverageNeutral: sum_averageOfAverage_neutral,
        sumMobEfetiveNeutral: sum_mobEfetive_neutral,
        sumMaxLikesNegative: sum_reports.sumNegativeMaxLikes,
        sumMaxRetweetsNegative: sum_reports.sumNegativeMaxRetweets,
        sumMaxRetweetsWithCommentsNegative:
          sum_reports.sumNegativeMaxRetweetsWithComments,
        sumMaxCommentsNegative: sum_reports.sumNegativeMaxComments,
        sumAverageOfAverageNegative: sum_averageOfAverage_negative,
        sumMobEfetiveNegative: sum_mobEfetive_negative,
        sumMaxLikesUnclassified: sum_reports.sumNClassMaxLikes,
        sumMaxRetweetsUnclassified: sum_reports.sumNClassMaxRetweets,
        sumMaxRetweetsWithCommentsUnclassified:
          sum_reports.sumNClassMaxRetweetsWithComments,
        sumMaxCommentsUnclassified: sum_reports.sumNClassMaxComments,
        sumAverageOfAverageUnclassified: sum_averageOfAverage_unclassified,
        sumMobEfetiveUnclassified: sum_mobEfetive_unclassified,
      });

      fs.writeFileSync(report_result_html, content);
      fs.writeFileSync(report_result_docx, content);

      htmlpdf.generatePdf({ content }, { format: "A4" }).then((pdfBuffer) => {
        fs.writeFileSync(report_result_pdf, pdfBuffer);
      });

      collect.status = "Finalizada";
      collect.pathHtml = report_result_html;
      collect.pathDocx = report_result_docx;
      collect.pathPdf = report_result_pdf;

      this.collectionRepository.save(collect);
    } catch (err) {
      console.log(err);
      return obj_response({
        status: "error",
        status_code: 500,
        message: "Houve um erro de comunicação, tente novamente mais tarde.",
      });
    }
  }
}
