import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'gk-ui-air-quality',
  templateUrl: './air.component.html',
  styleUrls: ['./air.component.less']
})
export class AirQualityComponent {
  @Input() number: number;
}
