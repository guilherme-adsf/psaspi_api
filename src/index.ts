import "reflect-metadata";
import { createConnection } from "typeorm";
import * as express from "express";
import * as bodyParser from "body-parser";
import { Request, Response } from "express";
import { Routes } from "./routes";
import axios from "axios";

createConnection()
  .then(async (connection) => {
    const app = express();
    app.use(bodyParser.json());

    app.get("/deeplink/:id", (req, res) => {
      res.redirect(`capitalsocial://resetpassword/${req.params.id}`);
    });

    app.get("/get_jobs_ids", (req, res) => {
      axios
        .get("http://localhost:5000/get_job_ids")
        .then((response) => {
          res.status(200).json({
            ...response.data,
          });
        })
        .catch((err) => {
          res.status(500).json({
            status: "error",
            message:
              "Houve um erro de comunicação, verifique sua conexão e tente novamente mais tarde.",
          });
        });
    });

    app.post("/collect", (req, res) => {
      axios
        .post("http://localhost:5000/coletar_dados", {
          id_perfil: req.body.id_perfil,
          quantidade_tweets: req.body.quantidade_tweets,
          user_id: req.body.user_id,
          start: req.body.start,
          id: req.body.id ? req.body.id : null,
        })
        .then((response) => {
          if (response.data.includes("não")) {
            res.status(500).json({
              status: "error",
              message:
                "Este perfil não existe, por favor verifique o id do perfil.",
            });
          } else {
            res.status(200).json({
              status: "success",
              message:
                "Pedido de coleta realizado com sucesso, você pode acompanhar o status da sua coleta em Minhas Coletas",
            });
          }
        })
        .catch((err) => {
          res.status(500).json({
            status: "error",
            message:
              "Houve um erro de comunicação, verifique sua conexão e tente novamente mais tarde.",
          });
        });
    });

    // register express routes from defined application routes
    Routes.forEach((route) => {
      (app as any)[route.method](
        route.route,
        (req: Request, res: Response, next: Function) => {
          const result = new (route.controller as any)()[route.action](
            req,
            res,
            next
          );
          if (result instanceof Promise) {
            result.then((result) =>
              result !== null && result !== undefined
                ? res.status(result.status_code).json(result.response)
                : undefined
            );
          } else if (result !== null && result !== undefined) {
            res.status(result.status_code).json(result.response);
          }
        }
      );
    });

    app.listen(3333);

    connection.runMigrations();
  })
  .catch((error) => console.log(error));
