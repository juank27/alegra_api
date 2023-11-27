require("dotenv").config();
const express = require("express");
const app = express();
const axios = require("axios");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const path = require("path");
const util = require("util");
const { v4: uuidv4 } = require("uuid");
const {
  authMiddleware,
  loadTokens,
  saveTokens,
  encryptToken,
} = require("./auth");
const bodyParser = require("body-parser");

app.use(bodyParser.json());
app.use(authMiddleware);
let token = loadTokens();

token[
  process.env.DEVELOPMENT ? process.env.EMAIL_AUTH_DEV : process.env.EMAIL_AUTH
] = encryptToken(
  process.env.DEVELOPMENT ? process.env.TOKEN_AUTH_DEV : process.env.TOKEN_AUTH
);

saveTokens(token, "admin");

const PORT = process.env.PORT || 3000;

// Ruta del archivo de registro
const logFilePath = path.join(__dirname, "logs", "consoleLogs.txt");

// Verifica si el directorio de logs existe, si no, créalo
if (!fs.existsSync(path.dirname(logFilePath))) {
  fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
}

// Abre el archivo de registro en modo append
const logStream = fs.createWriteStream(logFilePath, { flags: "a" });
const originalConsoleLog = console.log;

// Función personalizada para manejar console.log y escribir en el archivo
const customLogger = (...args) => {
  const logMessage = `${new Date().toISOString()} - ${util.format(...args)}\n`;

  // Llamar al console.log original
  originalConsoleLog(...args);

  // Escritura en el archivo de registro
  logStream.write(logMessage);
};

// Sobrescribe el método console.log con la función personalizada
console.log = customLogger;

const uploadsFolderPath = path.join(__dirname, "uploads");

// Configuración de multer para manejar la carga de archivos

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Ruta donde se guardarán los archivos
  },
  filename: function (req, file, cb) {
    // Personalizar el nombre del archivo
    cb(
      null,
      file.originalname.split(".")[0] + "." + file.originalname.split(".").pop()
    );
  },
});

const upload = multer({
  storage: storage, // directorio donde se almacenarán temporalmente los archivos
});

const deleteFilesInFolder = (folderPath) => {
  fs.readdir(folderPath, (err, files) => {
    if (err) {
      console.log("Error al leer el directorio:", err);
    }

    // Iterar sobre los archivos y eliminar cada uno
    files.forEach((file) => {
      const filePath = path.join(folderPath, file);

      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.log(`Error al eliminar el archivo ${filePath}:`, unlinkErr);
        } else {
          console.log(`Archivo temporal ${filePath} eliminado.`);
        }
      });
    });
  });
};
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Función para manejar la carga del archivo CSV
const handleCSVUpload = (req, res) => {
  return new Promise((resolve, reject) => {
    // Verificar si se proporcionó algún archivo
    if (!req.file) {
      reject({ error: "error", message: "No se envio ningún archivo." });
    }
    // Verificar la extensión del archivo
    const allowedExtensions = ["csv"];
    const fileExtension = req.file.originalname.split(".").pop();
    if (!allowedExtensions.includes(fileExtension)) {
      reject({
        error: "error",
        message: "El archivo debe tener extensión .csv",
      });
    }

    // Acceder al archivo cargado
    const uploadedFile = req.file;

    // Realizar acciones con el archivo, por ejemplo, analizar el archivo CSV
    const delimiter = ";"; // Definir el delimitador esperado
    const rows = [];

    // Utilizar csv-parser para analizar el archivo CSV
    const readableStream = require("fs").createReadStream(uploadedFile.path); // Utilizar el path del archivo

    readableStream
      .pipe(csvParser({ separator: delimiter }))
      .on("data", (row) => {
        rows.push(row);
      })
      .on("end", () => {
        // Realizar más acciones con las filas analizadas
        resolve(rows);
      })
      .on("error", (error) => {
        console.log("Error al analizar el archivo CSV:", error);
        reject("Error al analizar el archivo CSV");
      });
  });
};

app.post("/upload", upload.single("data"), (req, res) => {
  handleCSVUpload(req, res)
    .then((filePathName) => {
      deleteFilesInFolder(uploadsFolderPath);
      return res.status(200).json({
        message: "Archivo cargado correctamente.",
        filePath: filePathName,
      });
    })
    .catch((error) => {
      console.log("Error al analizar el archivo CSV:", error);
      deleteFilesInFolder(uploadsFolderPath);
      return res.status(500).json(error);
    });
});

// Ruta POST para generar y devolver un Bearer Token único
app.post("/generar-token", (req, res) => {
  const data = req.body;
  if (!data.email_admin) {
    return res.status(400).json({ message: "Falta el campo email_admin" });
  }
  if (!data.email) {
    return res.status(400).json({ message: "Falta el email" });
  }

  const email_admin = data.email_admin;
  const email = data.email;

  // Verificar las credenciales del admin
  const adminEmail = process.env.DEVELOPMENT
    ? process.env.EMAIL_AUTH_DEV
    : process.env.EMAIL_AUTH;
  const adminToken = process.env.DEVELOPMENT
    ? process.env.TOKEN_AUTH_DEV
    : process.env.TOKEN_AUTH;

  // Obtener el token del encabezado de autorización
  const authHeader = req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Acceso no autorizado. Falta el token Bearer." });
  }
  const token = authHeader.substring(7); // "Bearer " tiene 7 caracteres

  if (email_admin === adminEmail && token === adminToken) {
    // Crear un nuevo token UUID
    const newToken = uuidv4();

    // Cargar los tokens desde el archivo JSON
    let tokens = loadTokens();

    // Guardar el nuevo token en el archivo JSON
    tokens[email] = encryptToken(newToken);
    saveTokens(tokens, email);

    return res.json({ email, token: newToken });
  } else {
    return res.status(401).json({
      message:
        "Credenciales incorrectas. Verifique el bearer token o el email_admin",
    });
  }
});

app.get("/api/bill", (req, res) => {
  const filePath = "./data.csv";
  const csvData = readCSV(filePath);
  // console.log("🚀 ~ file: server.js:13 ~ app.get ~ csvData:", csvData);
  const parsedData = parseCSV(csvData);
  console.log("🚀 ~ file: server.js:15 ~ app.get ~ parsedData:", parsedData);
  const bill = toBill(parsedData);
  console.log("🚀 ~ file: server.js:17 ~ app.get ~ bill:", bill);
  return res.json(bill);
});
app.get("/api", (req, res) => {
  const options = {
    method: "POST",
    url: "https://api.alegra.com/api/v1/bills",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization:
        "Basic cHJ1ZWJhLnVuby5hcGlAZ21haWwuY29tOmI3OWNjNjZhNjMzNzdhNzhjMWI3",
    },
    data: {
      purchases: {
        items: [
          {
            id: 1,
            price: 900000,
            quantity: 1,
            discount: 20,
            name: "celular",
            observations: "celular xiaomi",
          },
        ],
      },
      date: "2022-09-23",
      dueDate: "2022-09-23",
      termsConditions: "",
      paymentMethod: "CASH",
      paymentType: "INSTRUMENT_NOT_DEFINED",
      billOperationType: "INDIVIDUAL",
      provider: 1,
      retentions: [{ id: 1, amount: 20 }],
    },
    // data: {
    //   purchases: {
    //     items: {
    //       observations: "Impresi�n en vinilo transparente laminado 15x3 cm",
    //     },
    //   },
    //   date: "01/01/2023",
    //   dueDate: "01/02/2023",
    //   paymentMethod: "Efectivo",
    //   paymentType: "cash",
    //   billOperationType: "INDIVIDUAL",
    //   provider: "1",
    // },
  };

  axios
    .request(options)
    .then(function (response) {
      console.log(
        "dadasddddddddddddddddddddddddddddddddddddddddddddddd",
        response.data
      );
      res.json(response.data);
    })
    .catch(function (error) {
      console.error(error);
      console.log("----------------------------------------, ", error);
      res.json({ error: error });
    });
});

app.post("/api/support", (req, res) => {
  const options = {
    method: "POST",
    url: "https://api.alegra.com/api/v1/bills",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization:
        "Basic cHJ1ZWJhLnVuby5hcGlAZ21haWwuY29tOmI3OWNjNjZhNjMzNzdhNzhjMWI3",
    },
    data: {
      purchases: { items: [{ id: 1, price: 2000, quantity: 1 }] },
      date: "2022-09-23",
      dueDate: "2022-09-23",
      termsConditions: "",
      paymentMethod: "CASH",
      paymentType: "INSTRUMENT_NOT_DEFINED",
      billOperationType: "INDIVIDUAL",
      provider: 1,
      stamp: { generateStamp: true },
    },
  };

  axios
    .request(options)
    .then(function (response) {
      console.log(
        "dadasddddddddddddddddddddddddddddddddddddddddddddddd",
        response.data
      );
      res.json(response.data);
    })
    .catch(function (error) {
      // console.error(error);
      // console.log("----------------------------------------, ", error);
      res.json({ error: error });
    });
});

const parseCSV = (csvData) => {
  const rows = csvData.split("\n");
  const headers = rows[0].split(";");
  console.log("🚀 ~ file: server.js:22 ~ parseCSV ~ headers:", headers);
  rows.shift();
  rows.pop();
  console.log("🚀 ~ file: server.js:23 ~ parseCSV ~ rows:", rows);
  const columns = rows[0].split(";");
  // console.log("🚀 ~ file: server.js:28 ~ parseCSV ~ columns:", columns);
  const parsedData = rows.map((row) => {
    const data = row.split(";");
    return Object.fromEntries(
      headers.map((column, index) => [column, data[index]])
    );
  });
  return parsedData;
};

const toBill = (parsedData) => {
  const data = parsedData.map((row) => {
    console.log("🚀 ~ file: server.js:41 ~ data ~ row:", row);
    return {
      purchases: {
        items: {
          id: row.id,
          price: row.price,
          quantity: row.quantity,
          discount: row.discount,
          name: row.name,
          observations: row.observations,
        },
      },
      date: row.date,
      dueDate: row.dueDate,
      termsConditions: row.termsConditions,
      paymentMethod: row.paymentMethod,
      paymentType: row.paymentType,
      billOperationType: row.billOperationType,
      provider: row.provider,
      // retentions: row.retentions.map((roww) => {
      //   return {
      //     id: roww.id,
      //     amount: roww.amount,
      //   };
      // }),
    };
  });
  return data;
};

const readCSV = (filePath) => {
  const fs = require("fs");
  const data = fs.readFileSync(filePath, "utf8");
  return data;
};

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Cerrar el stream cuando el servidor se cierra
server.on("close", () => {
  logStream.end();
  console.log("Stream cerrado. Hasta luego.");
});

// Manejar eventos de cierre de la aplicación
process.on("SIGINT", () => {
  server.close(() => {
    process.exit(0);
  });
});
