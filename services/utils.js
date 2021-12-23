const { Collection } = require('discord.js');

const fillCollection = function fillCollection(collection, elements) {
  for (let i = 0; i < elements.length; i += 1) {
    collection.set(i, elements[i]);
  }
  return collection;
};

module.exports = {
  fillCollection,
  collectionFromArray(elements) {
    return fillCollection(new Collection(), elements);
  },
};
