require("dotenv").config();
const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(
    "Turtle soup API: POST /api/chat, /api/manual-hint, /api/hint | GET /api/test, /api/capabilities",
  );
});
