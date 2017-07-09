import { Component, OnInit, Directive, ChangeDetectionStrategy } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'gk-ui-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.less']
})
export class ModalComponent implements OnInit {

  constructor() { }

  ngOnInit() {}
}

@Directive({
  selector: 'gk-modal-header, gk-modal-body' // tslint:disable-line
})
export class ModalDirectivesDirective {}
