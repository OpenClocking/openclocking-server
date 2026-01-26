// Import necessary modules
const fs = require("fs");
const path = require("path");

let defaultLang = "en"

// Object to store loaded language files
let languages = {};

// Function to load language files from the "languages" directory
function init(lang = "en") {
  defaultLang = lang || "en"
  const foldersPath = path.join(__dirname, "./languages");

  // Filter files to include only those with a ".json" extension
  const langFiles = fs
    .readdirSync(foldersPath)
    .filter((file) => file.endsWith(".json"));

  // Iterate through language files and load them into the 'languages' object
  for (const file of langFiles) {
    const filePath = path.join(foldersPath, file);
    const langCode = file.replace(".json", "");
    const lang = require(filePath);
    languages[langCode] = lang;
  }
}

// Function to translate a message in a specific language
function translate(langCode, path, arguments, originalLangCode = langCode) {

  // Define a default value based on the original language code and the provided path
  const defaultValue = `${originalLangCode}.${path}`;

  if (languages[langCode]) {
    // Check if the language file for the language code exists
    if (languages[langCode][path]) {
      // Retrieve the translation from the language file
      let translation = languages[langCode][path];
      let argumentsFilledTranslation = translation;

      // Replace placeholders in the translation with provided arguments
      if (arguments) {
        for (const [key, value] of Object.entries(arguments)) {
          argumentsFilledTranslation = argumentsFilledTranslation.replace(
            new RegExp(`{{${key}}}`, "g"),
            value
          );
        }
      }

      return argumentsFilledTranslation;
    } else {
      // If the translation is not found, use the default value
      if (langCode == defaultLang) {
        return defaultValue;
      } else {
        // If the language is not English, attempt to translate using English as a fallback
        return translate(defaultLang, path, arguments, langCode);
      }
    }
  } else {
    // If the language code is not found, use the default value
    if (langCode == defaultLang) {
      return defaultValue;
    } else {
      // If the language is not English, attempt to translate using English as a fallback
      return translate(defaultLang, path, arguments, langCode);
    }
  }
}

// Export the module with defined functions and language data
module.exports = {
  init,
  translate,
  languages,
};