import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'gk-ui-city',
  templateUrl: './city.component.html',
  styleUrls: ['./city.component.less']
})
export class CityComponent {
  @Input() name: string;
  @Input() image: string;
  @Input() longitude: number;
  @Input() latitude: number;
  @Output('onSelect') onSelect: EventEmitter<{}> = new EventEmitter<{}>();
}
