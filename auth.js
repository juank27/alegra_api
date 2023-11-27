const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  // Obtener el token del encabezado de autorización
  const authHeader = req.header("Authorization");

  // Verificar si hay un token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Acceso no autorizado. Falta el token Bearer." });
  }

  // Extraer el token del encabezado
  const token = authHeader.substring(7); // "Bearer " tiene 7 caracteres

  try {
    // Verificar y decodificar el token
    const decoded = jwt.verify(token, "tu_secreto"); // Reemplaza 'tu_secreto' con tu clave secreta

    // Agregar el usuario decodificado al objeto de solicitud
    req.user = decoded.user;

    // Continuar con la siguiente función de middleware o la ruta
    next();
  } catch (error) {
    console.error("Error de autenticación:", error);
    return res.status(401).json({ message: "Token no válido." });
  }
};

module.exports = authMiddleware;
