const dateFns = require('date-fns');
console.log('subMonths exists:', !!dateFns.subMonths);
console.log('eachMonthOfInterval exists:', !!dateFns.eachMonthOfInterval);
console.log('Keys:', Object.keys(dateFns).slice(0, 5));
