export const HTML_RECOVERY_PASSWORD = (id) => `<!DOCTYPE html
PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">

<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<title>Demystifying Email Design</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<link href="https://fonts.googleapis.com/css?family=Roboto" rel="stylesheet" />

<body style="background-color: #f5f5f5; text-align: center; padding-bottom: 20px">
    <a href="https://vps26803.publiccloud.com.br:3000/deeplink/${id}" style="
          background-color: #030d4f;
          border: none;
          color: white;
          text-align: center;
          text-decoration: none;
          display: inline-block;
          font-size: 1em;
          padding: 2% 4%;
          cursor: pointer;
          border-radius: 4px;
          margin-bottom: 10px;
          max-width: 70%;
          max-height: 20%;
        ">RECUPERAR SENHA</a>
</body>
</html>`;
