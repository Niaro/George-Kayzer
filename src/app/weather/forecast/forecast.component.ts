import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'gk-ui-forecast',
  templateUrl: './forecast.component.html',
  styleUrls: ['./forecast.component.less']
})
export class ForecastComponent {
  @Input() forecast: Array<{}>;
}
