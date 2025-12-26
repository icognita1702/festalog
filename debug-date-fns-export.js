const subMonths = require('date-fns/subMonths');
console.log('Type of subMonths:', typeof subMonths);
console.log('Is function?', typeof subMonths === 'function');
console.log('Has default?', !!subMonths.default);
console.log('Keys:', Object.keys(subMonths));
