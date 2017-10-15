let Stream = function (vm, id) {
  let self = this;
  self.parent = vm;

  self.id = id;

  self._CP = ko.observable(0);
  self._supplyTemp = ko.observable(0);
  self._targetTemp = ko.observable(0);

  self.CP = () => parseFloat(self._CP());
  self.supplyTemp = () => parseFloat(self._supplyTemp());
  self.targetTemp = () => parseFloat(self._targetTemp());

  self.type = ko.computed(() => {
    return self.supplyTemp() > self.targetTemp() ? 'Hot' : 'Cold'
  });
  self.heatLoad = ko.computed(() => {
    return self.CP() * (self.targetTemp() - self.supplyTemp())
  });

  self.remove = function () {
    self.parent.streams.remove(self);
  }
}

let Interval = function (upperTemp) {
  let self = this;

  self.upperTemp = ko.observable(upperTemp);
}

let PinchViewModel = function () {
  let self = this;

  self.streams = ko.observableArray()
  self.hotStreams = () => self.streams().filter(s => s.type != 'Hot');
  self.coldStreams = () => self.streams().filter(s => s.type != 'Cold');

  self.addStream = function () {
    self.streams.push(new Stream(self, self.streams().length + 1));
  }

  self.maxDT = ko.computed(() => {
    let hottestHotStream = Math.max.apply({},
      self.hotStreams().map(s => s.supplyTemp()));
    let coldestColdStream = Math.min.apply({},
      self.coldStreams().map(s => s.supplyTemp()));
    return hottestHotStream - coldestColdStream;
  });

  self._DTMin = ko.observable(10);
  self.DTMin = ko.computed(() => parseFloat(self._DTMin()));

  self.intervals = ko.observableArray();
  self.calculateIntervals = function () {
    let coldStreamTemps = self.coldStreams().reduce((arr, s) => {
      arr.push(s.supplyTemp() - self.DTMin())
      arr.push(s.targetTemp() - self.DTMin())
      return arr
    }, []);
    let hotStreamTemps = self.hotStreams().reduce((arr, s) => {
      arr.push(s.supplyTemp());
      arr.push(s.targetTemp());
      return arr
    }, []);
    let temps = Array.from(
      new Set(coldStreamTemps.concat(hotStreamTemps))
    ).sort((a,b) => a - b).reverse();
    temps.forEach(t => self.intervals.push(new Interval(t)));
  }

  self.load2StreamProblem = function () {
    self.addStream();
    self.addStream();
    let s1 = self.streams()[0];
    s1._supplyTemp(200);
    s1._targetTemp(70);
    s1._CP(5);
    let s2 = self.streams()[1];
    s2._supplyTemp(100);
    s2._targetTemp(135);
    s2._CP(20);
  }
}

let vm = new PinchViewModel();
ko.applyBindings(vm);
vm.load2StreamProblem();
