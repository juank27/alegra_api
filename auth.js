const fs = require("fs");
const authFile = "auth.json";
const crypto = require("crypto");

// Middleware para validar la autenticación con token Bearer
const authMiddleware = (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Acceso no autorizado. Falta el Bearer token." });
  }

  const token = authHeader.substring(7); // "Bearer " tiene 7 caracteres

  // Desencriptar todos los tokens antes de validar la autenticación
  const tokens = loadTokens();
  const decryptedTokens = Object.keys(tokens).reduce((acc, userEmail) => {
    acc[userEmail] = decryptToken(tokens[userEmail]);
    return acc;
  }, {});

  const userEmail = Object.keys(decryptedTokens).find(
    (key) => decryptedTokens[key] === token
  );

  // validate token and email
  if (!token || !userEmail || decryptedTokens[userEmail] !== token) {
    return res.status(401).json({ message: "Token no válido." });
  }
  console.log(`Usuario autenticado: ${userEmail}`);
  req.userEmail = userEmail;
  next();
};

// Función para cargar tokens desde el archivo JSON
const loadTokens = () => {
  try {
    const data = fs.readFileSync(authFile, "utf8");
    return JSON.parse(data) || {};
  } catch (error) {
    return {};
  }
};

// Función para guardar tokens en el archivo JSON
const saveTokens = (token, email) => {
  console.log(`Guardando token para el usuario ${email}`);
  fs.writeFileSync(authFile, JSON.stringify(token, null, 2));
};

const encryptToken = (token) => {
  const cipher = crypto.createCipher("aes-256-cbc", process.env.secretKey);
  let encryptedToken = cipher.update(token, "utf8", "hex");
  encryptedToken += cipher.final("hex");
  return encryptedToken;
};

// Función para desencriptar un token
const decryptToken = (encryptedToken) => {
  const decipher = crypto.createDecipher("aes-256-cbc", process.env.secretKey);
  let decryptedToken = decipher.update(encryptedToken, "hex", "utf8");
  decryptedToken += decipher.final("utf8");
  return decryptedToken;
};

module.exports = { authMiddleware, loadTokens, saveTokens, encryptToken };
