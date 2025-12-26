try {
    const subMonths = require('date-fns/subMonths');
    console.log('require("date-fns/subMonths") worked:', !!subMonths);
} catch (e) {
    console.log('require("date-fns/subMonths") failed:', e.message);
}
