const fs = require('fs');
const parser = require('@babel/parser');

try {
  const code = fs.readFileSync('src/App.jsx', 'utf8');
  parser.parse(code, {
    sourceType: "module",
    plugins: ["jsx"]
  });
  console.log("No syntax errors found.");
} catch (e) {
  console.error("Syntax Error at line " + e.loc.line + " col " + e.loc.column);
  console.error(e.message);
}
