import * as https from "https";
import { RequestOptions, IncomingMessage } from "https";

import * as moment from 'moment';

import { Observable } from 'rxjs';

let get$ = Observable.bindCallback(https.get);

let habiticaOptions = (url, headers = {}) => ({
	path: `/api/v3/${url}`,
	hostname: 'habitica.com',
	headers: {
		'x-api-user': '3027ccc6-1040-411a-bb36-c4d3af044c1b',
		'x-api-key': 'b3e15465-e8d1-4c45-8b0e-035093ed8aa5',
		...headers
	}
});

let habiticaGet$ = url => get$(habiticaOptions(url));

let habiticaPost$ = url => Observable.create(observer => {
	const req = https.request({
		method: 'POST',
		...habiticaOptions(url)
	}, res => observer.next(res));
	req.end();
})
	.let(formatResponse$);

let getWakatimeDailyDuration$ = ($: Observable<any>) => $
	.map(() => moment().format('YYYY-MM-DD'))
	.flatMap(date => get$(`https://wakatime.com/api/v1/users/@Niaro/durations?date=${date}&api_key=9ed179c7-8391-4af5-8907-bf996b15774e`))
	.let(formatResponse$)
	.map(wakatime => wakatime.data.reduce((acc, v) => acc += v.duration, 0))
	.map(seconds => seconds / 3600);

let getHabiticaTask$ = ($: Observable<any>) => $
	.flatMapTo(habiticaGet$('tasks/user'))
	.let(formatResponse$)
	.map(habitica => habitica.data.find(v => v.alias.includes('8-hours-work')))
	.filter(task => !task.completed);

let scoreHabiticaTask$ = ($: Observable<{ id: string }>): Observable<{ id: string }> => $
	.flatMap(({ id }) => habiticaPost$(`tasks/${id}/score/up`), task => task)

let moveToBottomHabiticaTask$ = ($: Observable<{ id: string }>) => $
	.flatMap(({ id }) => habiticaPost$(`tasks/${id}/move/to/-1`), task => task)

let formatResponse$ = ($: Observable<IncomingMessage>) => $
	.flatMap(res => Observable.fromEventPattern(handler => res.once('data', <any>handler)))
	.map(buffer => Buffer.isBuffer(buffer) ? JSON.parse(buffer.toString()) : false)
	.filter(result => !!result);

export function habiticaWakatimeIntegration() {
	Observable
		.interval(900000)
		.startWith(null)
		.retry(10)
		.let(getWakatimeDailyDuration$)
		.filter(hours => hours > 8)
		.let(getHabiticaTask$)
		.let(scoreHabiticaTask$)
		.let(moveToBottomHabiticaTask$)
		.subscribe(() => console.log('success'))
}