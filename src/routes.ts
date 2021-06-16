import { UserController } from "./controller/UserController";

export const Routes = [
  {
    method: "put",
    route: "/updateaccount",
    controller: UserController,
    action: "update",
  },
  {
    method: "post",
    route: "/createaccount",
    controller: UserController,
    action: "save",
  },
  {
    method: "post",
    route: "/login",
    controller: UserController,
    action: "login",
  },
  {
    method: "get",
    route: "/sendemailrecoverypassword/:email",
    controller: UserController,
    action: "send_email_recovery_password",
  },
  {
    method: "post",
    route: "/resetpassword",
    controller: UserController,
    action: "resetpassword",
  },
  {
    method: "get",
    route: "/getcollects/:id",
    controller: UserController,
    action: "getcollects",
  },
  {
    method: "get",
    route: "/gettweetsofcollect/:id",
    controller: UserController,
    action: "gettweetsofcollect",
  },
  {
    method: "post",
    route: "/exportcsv",
    controller: UserController,
    action: "exportcsv",
  },
  {
    method: "get",
    route: "/collectionreport/:id",
    controller: UserController,
    action: "collection_report",
  },
  {
    method: "post",
    route: "/exportreport",
    controller: UserController,
    action: "exportreport",
  },
  {
    method: "get",
    route: "/viewcollection/:id",
    controller: UserController,
    action: "viewcollection",
  },
  {
    method: "get",
    route: "/deletecollection/:id",
    controller: UserController,
    action: "deletecollection",
  },
  {
    method: "post",
    route: "/exportallreports",
    controller: UserController,
    action: "exportallreports",
  },
  {
    method: "get",
    route: "/verifyibmkey",
    controller: UserController,
    action: "verify_ibm_token_status",
  },
];
