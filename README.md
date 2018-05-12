# CIR-FOOD

Cir-Food reverse API implementation in NodeJS.

### Configuration

All API are authenticated, so you must first of all configure your client.

```js
const CirFood = require('cir-food');

const username = process.env.CIRFOOD_USERNAME;
const password = process.env.CIRFOOD_PASSWORD;
const client = new CirFood(username, password);
```

### Start a booking

```js
client.startBooking(new Date('2018-05-11');
```

#### Get courses

Once you start a booking, you can get all courses for that day.

```js
const courses = client.booking.courses;
```

#### Add a course to current booking

Once you got courses, use that IDs to add a course to current booking

```js
const course_id = courses.data[0].id;
client.addCourseToCurrentBooking(course_id)
```

#### Submit booking

```js
client.submitCurrentBooking
```
