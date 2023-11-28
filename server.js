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

const HOST = process.env.DEVELOPMENT
  ? process.env.ENDPOINT_DEV
  : process.env.ENDPOINT;

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

app.post("/upload", upload.single("data"), (req, res) => {
  handleCSVUpload(req, res)
    .then((filePathName) => {
      deleteFilesInFolder(uploadsFolderPath);
      if (filePathName.length <= 1) {
        return res.status(400).json({
          message: "El archivo no tiene datos.",
        });
      }
      if (filePathName.length > 100) {
        return res.status(400).json({
          message:
            "El archivo tiene más de 100 registros. Excede el límite para procesar.",
        });
      }
      const validationErrors = validateFields(filePathName);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: "El archivo tiene errores en los siguientes campos:",
          errors: validationErrors,
        });
      }
      const groupedData = groupObjectsById(filePathName);
      getNumberTemplate()
        .then((response) => {
          const idNumeration = response.data
            .filter((obj) => obj.name === "Documento soporte")
            .map((obj) => obj.id);
          console.log(
            "🚀 ~ file: server.js:226 ~ .then ~ idNumeration:",
            typeof idNumeration[0]
          );
          const objectRequest = transformData(groupedData, idNumeration[0]);
          return res.status(200).json({
            message: "Archivo cargado correctamente.",
            filePath: objectRequest,
          });
        })
        .catch((error) => {
          console.log("Error al obtener el id de numeracion", error);
          return res.status(500).json(error);
        });
    })
    .catch((error) => {
      console.log("Error al analizar el archivo CSV:", error);
      deleteFilesInFolder(uploadsFolderPath);
      return res.status(500).json(error);
    });
});

app.get("/", (req, res) => {
  const options = {
    method: "POST",
    url: "https://sandbox.alegra.com:26967/api/v1/bills",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization:
        "Basic YWVyb3JlbnRhbCthbGVncmFAYWxlZ3JhLmNvbTo5YzBjNWU3MTExYTIwMjkyZjAyNA==",
    },
    data: {
      numberTemplate: { id: "10" },
      purchases: {
        items: [
          {
            id: 118,
            name: "",
            discount: 0,
            quantity: 1,
            observations: "Billetera de cuero negro",
            price: 1,
            subtotal: null,
            tax: [],
          },
          {
            id: 118,
            name: "",
            discount: 0,
            observations: "otraaaa",
            quantity: 1,
            tax: [],
            price: 70,
          },
        ],
      },
      currency: { code: "USD", symbol: "$", exchangeRate: 2950 },
      paymentType: "CASH",
      billOperationType: "INDIVIDUAL",
      date: "2023-02-11",
      dueDate: "2023-02-12",
      provider: 15,
      // retentions: [],
    },
  };

  axios
    .request(options)
    .then(function (response) {
      // console.log(JSON.parse(response.data));
      return res.json(response.data);
    })
    .catch(function (error) {
      console.error(error);
      return res.json(error);
    });
  // res.send("Hello AeroRental!");
});

const validateFields = (data) => {
  const requiredFields = [
    "id",
    "date",
    "dueDate",
    "provider",
    "purchases_id",
    "purchases_price",
    "purchases_quantity",
    "purchases_total",
    // "prchases_subtotal",
    "currency_code",
    "currency_symbol",
    "currency_exhangeRate",
    "paymentMethod",
    "paymentType",
    "billOperationType",
    "stamp",
  ];

  const errors = [];

  data.forEach((obj, index) => {
    const objectErrors = [];

    requiredFields.forEach((field) => {
      if (!obj[field] || obj[field].trim() === "") {
        objectErrors.push(field);
      }
    });

    if (objectErrors.length > 0) {
      errors.push({ id: obj.id, errors: objectErrors });
    }
  });
  return errors;
};

const groupObjectsById = (array) => {
  return array.reduce((accumulator, currentValue) => {
    const id = currentValue.id;
    const existingGroup = accumulator.find((group) => group.id === id);

    if (existingGroup) {
      existingGroup.objects.push(currentValue);
    } else {
      accumulator.push({ id, objects: [currentValue] });
    }

    return accumulator;
  }, []);
};

const getNumberTemplate = () => {
  const auth = credentialsBase64();
  const options = {
    method: "GET",
    url: HOST + "/api/v1/number-templates",
    headers: {
      accept: "application/json",
      authorization: "Basic " + auth,
    },
  };

  return axios.request(options);
};

const createBill = (data) => {
  const auth = credentialsBase64();
  const options = {
    method: "POST",
    url: HOST + "/api/v1/bills",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: "Basic " + auth,
    },
  };
};
const credentialsBase64 = () => {
  const credentials = process.env.DEVELOPMENT
    ? process.env.EMAIL_DEV + ":" + process.env.TOKEN_DEV
    : process.env.EMAIL + ":" + process.env.TOKEN;
  const base64Credentials = Buffer.from(credentials, "utf-8").toString(
    "base64"
  );
  return base64Credentials;
};

// Función para transformar un objeto individual según el formato requerido
const transformObject = (originalObject, numeration) => {
  const transformedObject = {
    numberTemplate: { id: numeration },
    purchases: {
      items: originalObject.objects.map((item) => {
        return {
          id: parseInt(item.purchases_id),
          name: item.purchases_name,
          discount: parseFloat(item.purchases_discount) || 0,
          observations: item.purchases_observations,
          quantity: parseInt(item.purchases_quantity),
          price: parseFloat(item.purchases_price),
          total: item.purchases_total ? parseFloat(item.purchases_total) : null,
          subtotal: item.purchases_subtotal
            ? parseFloat(item.purchases_subtotal)
            : null,
          tax: item.tax_id
            ? [
                {
                  id: parseInt(item.tax_id),
                  name: item.tax_name,
                  percentaje: item.tax_percentaje
                    ? parseFloat(item.tax_percentaje)
                    : 0,
                  type: item.tax_type,
                  status: item.tax_status,
                },
              ]
            : [],
        };
      }),
    },
    currency: {
      code: originalObject.objects[0].currency_code,
      symbol: originalObject.objects[0].currency_symbol,
      exchangeRate: parseFloat(originalObject.objects[0].currency_exhangeRate),
    },
    paymentType: originalObject.objects[0].paymentType,
    billOperationType: originalObject.objects[0].billOperationType,
    date: originalObject.objects[0].date,
    dueDate: originalObject.objects[0].dueDate,
    provider: parseInt(originalObject.objects[0].provider),
    observations: originalObject.objects[0].observations,
    // retentions: originalObject.objects.map((item) => {
    //   return {
    //     id: parseInt(item.retentions_id) || 0,
    //     amount: parseFloat(item.retentions_amount) || 0,
    //   };
    // }),
    retentions: [],
    stamp: { generateStamp: Boolean(originalObject.objects[0].stamp) },
  };
  // Agregar retentions solo si hay datos
  originalObject.objects.forEach((item) => {
    if (item.retentions_id) {
      transformedObject.retentions.push({
        id: parseInt(item.retentions_id),
        amount: parseFloat(item.retentions_amount),
      });
    }
  });
  return transformedObject;
};

// Función para transformar el array completo
const transformData = (originalData, numeration) => {
  const transformedData = [];

  originalData.forEach((originalObject) => {
    // Verificar que todos los objetos tengan el mismo provider
    const uniqueProviders = new Set(
      originalObject.objects.map((item) => item.provider)
    );
    if (uniqueProviders.size !== 1) {
      console.error(
        `Error: No todos los objetos en el grupo ${originalObject.id} tienen el mismo provider.`
      );
      return;
    }

    const transformedObject = transformObject(originalObject, numeration);
    transformedData.push(transformedObject);
  });

  return transformedData;
};
//_----------------------------------------------------------------------------------------------
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
