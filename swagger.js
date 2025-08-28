// swagger.js
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Admin API",
      version: "1.0.0",
      description: "API documentation for Admin management",
    },
    servers: [
      {
        url: "http://localhost:5000/api/admin", // adjust if needed
      },
    ],
  },
  apis: ["./routes/*.js"], // <-- This scans your route files for Swagger comments
};

const swaggerSpec = swaggerJsDoc(options);

function swaggerDocs(app, port) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  console.log(`📘 Swagger Docs available at http://localhost:${port}/api-docs`);
}

module.exports = swaggerDocs;
