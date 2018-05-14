const CirFood = require('./index.js');

(async function main() {
	const c = new CirFood(process.env.CIRFOOD_USERNAME, process.env.CIRFOOD_PASSWORD);
	c.login();
	const booking = await c.startBooking(new Date('2018-05-10'));
	await c.addCourseToCurrentBooking(booking.courses[0].data[1].id);
	await c.addCourseToCurrentBooking(booking.courses[1].data[0].id);
	await c.addCourseToCurrentBooking(booking.courses[2].data[0].id);
	await c.submitCurrentBooking();
})();