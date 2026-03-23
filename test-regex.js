const locationId = "E1-M1-A1";
const shelfMatch = locationId.match(/^E.*?([0-9]+[A-Z]?).*?M.*?(\d+).*?A.*?(\d+)/i);
console.log(shelfMatch);
