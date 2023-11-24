require("dotenv").config();
const express = require("express");
const app = express();
const axios = require("axios");
const multer = require("multer");
const csvParser = require("csv-parser");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
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
      console.error("Error al leer el directorio:", err);
    }

    // Iterar sobre los archivos y eliminar cada uno
    files.forEach((file) => {
      const filePath = path.join(folderPath, file);

      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(`Error al eliminar el archivo ${filePath}:`, unlinkErr);
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
      // return res.status(400).json({
      //   error: "error",
      //   message: "El archivo debe tener extensión .csv",
      // });
      reject({
        error: "error",
        message: "El archivo debe tener extensión .csv",
      });
    }

    // Acceder al archivo cargado
    const uploadedFile = req.file;
    // console.log(
    //   "🚀 ~ file: server.js:42 ~ handleCSVUpload ~ uploadedFile:",
    //   uploadedFile
    // );

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
        console.error("Error al analizar el archivo CSV:", error);
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
      console.error("Error al analizar el archivo CSV:", error);
      deleteFilesInFolder(uploadsFolderPath);
      return res.status(500).json(error);
    });
});

app.get("/api/bill", (req, res) => {
  const filePath = "./data.csv";
  const csvData = readCSV(filePath);
  // console.log("🚀 ~ file: server.js:13 ~ app.get ~ csvData:", csvData);
  const parsedData = parseCSV(csvData);
  console.log("🚀 ~ file: server.js:15 ~ app.get ~ parsedData:", parsedData);
  const bill = toBill(parsedData);
  console.log("🚀 ~ file: server.js:17 ~ app.get ~ bill:", bill);
  res.json(bill);
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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
