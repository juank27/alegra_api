const axios = require("axios");

const options = {
  method: "POST",
  url: "https://api.alegra.com/api/v1/bills",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    authorization:
      "Basic cHJ1ZWJhLnVuby5hcGlAZ21haWwuY29tOmI3OWNjNjZhNjMzNzdhNzhjMWI3",
  },
  // data: {
  //   purchases: {
  //     items: [
  //       {
  //         id: 1,
  //         price: 900000,
  //         quantity: 1,
  //         discount: 20,
  //         name: "celular",
  //         observations: "celular xiaomi",
  //       },
  //     ],
  //   },
  //   date: "2022-09-23",
  //   dueDate: "2022-09-23",
  //   termsConditions: "",
  //   paymentMethod: "CASH",
  //   paymentType: "INSTRUMENT_NOT_DEFINED",
  //   billOperationType: "INDIVIDUAL",
  //   provider: 1,
  //   retentions: [{ id: 1, amount: 20 }],
  // },
  data: {
    purchases: {
      items: {
        observations: "Impresi�n en vinilo transparente laminado 15x3 cm",
      },
    },
    date: "01/01/2023",
    dueDate: "01/02/2023",
    paymentMethod: "Efectivo",
    paymentType: "cash",
    billOperationType: "INDIVIDUAL",
    provider: "1",
  },
};

axios
  .request(options)
  .then(function (response) {
    console.log(response.data);
  })
  .catch(function (error) {
    console.error(error);
  });
