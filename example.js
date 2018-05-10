(async function main() {
	const c = new CirFood(process.env.USERNAME, process.env.PADSSOWRD);
	const booking = await c.startBooking(new Date('2018-05-10'));
	await c.addCourseToCurrentBooking(booking.courses[0].data[1].id);
	await c.addCourseToCurrentBooking(booking.courses[1].data[0].id);
	await c.addCourseToCurrentBooking(booking.courses[2].data[0].id);
	await c.submitCurrentBooking();
})();