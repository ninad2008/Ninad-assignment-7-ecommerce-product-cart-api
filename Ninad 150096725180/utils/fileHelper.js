const fs = require('fs/promises');
const path = require('path');

/**
 * Asynchronously read data from a JSON file in the data folder.
 * If the file doesn't exist or is invalid JSON, returns an empty array.
 * @param {string} filename
 * @returns {Promise<Array<object>>}
 */
const readData = async (filename) => {
  const filePath = path.join(__dirname, '../data', filename);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    if (!data.trim()) {
      return [];
    }
    return JSON.parse(data);
  } catch (error) {
    // If file does not exist, return empty array
    return [];
  }
};

/**
 * Asynchronously write data to a JSON file in the data folder.
 * @param {string} filename
 * @param {any} data
 * @returns {Promise<void>}
 */
const writeData = async (filename, data) => {
  const dataDir = path.join(__dirname, '../data');
  const filePath = path.join(dataDir, filename);
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing to ${filename}:`, error.message);
    throw error;
  }
};

module.exports = { readData, writeData };
