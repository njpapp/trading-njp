module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current', // Apuntar a la versión actual de Node.js en el entorno de ejecución
        },
      },
    ],
  ],
};
