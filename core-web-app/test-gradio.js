const { Client } = require("@gradio/client");

async function testConnection() {
  console.log("Attempting to connect to venkatesh001/gui-pig-ml-service...");
  try {
    const app = await Client.connect("venkatesh001/gui-pig-ml-service");
    console.log("Connection successful!");
    console.log("Endpoints:", app.config.dependencies.map(d => d.api_name));
  } catch (error) {
    console.error("Connection failed with error:");
    console.error(error);
  }
}

testConnection();
