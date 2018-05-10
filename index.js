const request = require('request-promise-native');
const tough = require('tough-cookie');

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

async function parseXMLString(xml, callback) {
	return new Promise((resolve, reject) => {
		require('xml2js').parseString(xml, (err, result) => {
			if (err) return reject(err);
			return resolve(result);
		});
	});
}

if (process.env.DEBUG) {
	require('request-debug')(request);
}

const API_HOST = 'https://potter4.cir-food.it/bbw2/mobile';

class CirFood {

	constructor(username, password) {
		this.username = username;
		this.password = password;
		this.cookiejar = request.jar();
		this.loggedIn = false;
	}

	extractViewStateFromHtml(response) {
		return response.match(/id\=\"j_id__v_0:javax\.faces\.ViewState:1\"\s+value\=\"([^"]+)\"/)[1];
	}

	async simpleRequest(opt) {
		opt.jar = this.cookiejar;
		opt.followAllRedirects = true;
		return request(opt);
	}

	async postRequest(opt) {
		opt.formData['javax.faces.ViewState'] = this.viewState;
		opt.formData['javax.faces.partial.ajax'] = 'true';
		opt.method = 'POST';

		const response = await this.simpleRequest(opt);
		const response_xml = await parseXMLString(response);
		
		// Find the new Viewstate
		const view_state_node = response_xml['partial-response'].changes[0].update.find(e => {
			return e.$.id === 'j_id__v_0:javax.faces.ViewState:1';
		});
		if (view_state_node == null) throw new Error('NO_VIEWSTATE');
		this.viewState = view_state_node._;

		const xml_node = response_xml['partial-response'].changes[0].update[0]._;
		return new JSDOM(xml_node);
	}

	async login() {
		if (this.loggedIn === true) return;

		this.viewState = this.extractViewStateFromHtml(await this.simpleRequest({
			uri: API_HOST + '/login.xhtml'
		}));

		this.viewState = this.extractViewStateFromHtml(await this.simpleRequest({
			uri: API_HOST + '/login.xhtml',
			method: 'POST',
			formData: {
				'j_id_v:username': this.username,
				'j_id_v:password': this.password,
				'j_id_v:j_id_w_1_9': 'Sign in',
				'j_id_v_SUBMIT': '1',
				'javax.faces.ViewState': this.viewState
			}
		}));

		this.loggedIn = true;

		return true;
	}

	async startBooking(date) {
		await this.login();

		// Format that date to be compatible with API
		const formatted_date = [ 
			date.getDate().toString().padStart(2, '0'), 
			(date.getMonth()+1).toString().padStart(2, '0'),
		].join('/');

		const response_days = await this.postRequest({
			uri: API_HOST + '/bookings.xhtml',
			formData: {
				'headerButtons_SUBMIT': '1',
				'javax.faces.behavior.event': 'action',
				'javax.faces.partial.event': 'click',
				'javax.faces.source': 'headerButtons:j_id_14', // NEW BUTTON
				'javax.faces.partial.execute': 'headerButtons',
				'javax.faces.partial.render': 'newModalForm:days',
			}
		});

		// Get days
		const days = Array.from(
			response_days.window.document.querySelectorAll('.new-booking-day label')
		).map(label => {
			return {
				id: label.getAttribute('id'),
				text: label.querySelector('.day').innerHTML
			};
		});

		const day = days.find(e => e.text.substr(formatted_date) !== -1);
		if (day == null) throw new Error('DAY_NOT_FOUND');

		const response_days_checked = await this.postRequest({
			uri: API_HOST + '/bookings.xhtml',
			formData: {
				'newModalForm_SUBMIT': '1',
				'javax.faces.behavior.event': 'click',
				'javax.faces.partial.event': 'click',
				'javax.faces.source': day.id,
				'javax.faces.partial.execute': day.id,
				'javax.faces.partial.render': 'newModalForm:days'
			}
		});

		// Check that this day is effectively checked
		const radio = response_days_checked.window.document.querySelector('label.bs-radio.active');
		if (radio.getAttribute('id') !== day.id) throw new Error('DAY_RADIO_MISMATCH');

		const response_meals = await this.postRequest({
			uri: API_HOST + '/bookings.xhtml',
			formData: {
				'newModalForm_SUBMIT': '1',
				'javax.faces.behavior.event': 'action',
				'javax.faces.partial.event': 'click',
				'javax.faces.source': 'newModalForm:confirm',
				'javax.faces.partial.execute': 'newModalForm',
				'javax.faces.partial.render': 'contentForm',
			}
		});

		const confirm_btn = response_meals.window.document.querySelector('input[type=submit][value=Confirm]');
		if (confirm_btn == null) throw new Error('BTN_CONFIRM_NOTFOUND');
		const confirm_id = confirm_btn.getAttribute('id');

		const courses = Array.from(
			response_meals.window.document.querySelectorAll('.dishKind')
		).map(e => {
			return {
				kind: e.querySelector('label:first-child').innerHTML.replace(/\t|\n/g, ''),
				data: Array.from(e.querySelectorAll('.panel-row')).map(e => {
					return {
						id: e.querySelector('.quantity label:last-child').getAttribute('id').replace('contentForm:', ''),
						hid: e.querySelector('.detail-with-dishcode-left .panel-body').innerHTML.replace(/\t|\n/g, ''),
						text: e.querySelector('.detail-with-dishcode-right .description > span:first-child').innerHTML.replace(/\t|\n/g, '')
					};
				})
			};
		});

		this.booking = { 
			confirm_id: confirm_id,
			courses: courses
		};

		return this.booking;
	}

	async addCourseToCurrentBooking(course_id) {
		if (this.booking == null) throw new Error('NO_BOOKING_STARTED');

		const course_dk = course_id.match(/dk\:(\d+)/)[1];
		const course_d = course_id.match(/d\:(\d+)/)[1];

		const response = await this.postRequest({
			uri: API_HOST + '/bookings.xhtml',
			formData: {
				'contentForm_SUBMIT': '1',
				'javax.faces.behavior.event': 'click',
				'javax.faces.partial.event': 'click',
				'javax.faces.source': `contentForm:${course_id}`,
				'javax.faces.partial.execute': `contentForm:${course_id}`,
				'javax.faces.partial.render': `contentForm:dk:${course_dk}:dishKind`
			}
		});

		// Ensure qty is one
		const qty_label = Array.from(
			response.window.document.querySelectorAll('.quantity .outputField')
		).find(e => {
			return e.getAttribute('id') === `contentForm:dk:${course_dk}:d:${course_d}:quantity`;
		});
		if (qty_label == null) throw new Error('LBL_QTY_NOT_FOUND');

		const qty_num = parseInt(qty_label.innerHTML, 10);
		if (qty_num !== 1) throw new Error('QTY_NOT_UNIT: ' + qty_num);

		return true;
	}

	async submitCurrentBooking() {
		if (this.booking == null) throw new Error('NO_BOOKING_STARTED');

		const response = await this.postRequest({
			url: API_HOST + '/bookings.xhtml',
			formData: {
				'contentForm_SUBMIT': '1',
				'javax.faces.behavior.event': 'action',
				'javax.faces.partial.event': 'click',
				'javax.faces.source': this.booking.confirm_id,
				'javax.faces.partial.execute': 'contentForm',
				'javax.faces.partial.render': 'confirmedBookingModalForm:dialog'
			}
		});

		const thank_you_h2 = response.window.document.querySelector('h2').innerHTML;
		if (thank_you_h2.substr('Thank') === -1) throw new Error('BOOKING_UNKOWN_ERR');

		this.booking = null;

		return true;
	}


}