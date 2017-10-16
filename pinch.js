
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

let Interval = function (vm, index, upperTemp, lowerTemp) {
  let self = this;
  self.parent = vm;

  self.index = romanize(index + 1);
  self.hotSideUpperTemp = upperTemp;
  self.hotSideLowerTemp = lowerTemp;
  self.coldSideUpperTemp = upperTemp - self.parent.DTMin();
  self.coldSideLowerTemp = lowerTemp - self.parent.DTMin();

  self.hotSideTempRange = () => {
    return self.hotSideUpperTemp.toString() + ' - ' +
      self.hotSideLowerTemp.toString()
  }
  self.coldSideTempRange = () => {
    return self.coldSideUpperTemp.toString() + ' - ' +
      self.coldSideLowerTemp.toString()
  }
  self.DT = () => self.hotSideUpperTemp - self.hotSideLowerTemp;

  self.streams = function () {
    let hotStreams = self.parent.hotStreams().filter(s => {
      return s.supplyTemp() >= self.hotSideUpperTemp &&
             s.targetTemp() <= self.hotSideLowerTemp
    })
    let coldStreams = self.parent.coldStreams().filter(s => {
      return s.supplyTemp() <= self.coldSideLowerTemp &&
             s.targetTemp() >= self.coldSideUpperTemp
    })
    return hotStreams.concat(coldStreams);
  }
  self.streamIds = () => self.streams().map(s => s.id);

  self.netHeatLoad = () => {
    return self.streams().reduce((q, s) => {
      let cp = s.CP();
      if (s.type() == 'Hot') cp = -cp;
      return q + (cp * self.DT());
    }, 0);
  }

  self.surplusOrDeficit = () => {
    if (self.netHeatLoad() > 0) {
      return 'Deficit'
    } else if (self.netHeatLoad() < 0) {
      return 'Surplus'
    } else {
      return 'Neither'
    }
  }
}

let PinchViewModel = function () {
  let self = this;

  self.streams = ko.observableArray()
  self.hotStreams = () => self.streams().filter(s => s.type() != 'Cold');
  self.coldStreams = () => self.streams().filter(s => s.type() != 'Hot');

  self.addStream = function () {
    self.streams.push(new Stream(self, self.streams().length + 1));
  }

  self.netHeatLoad = ko.computed(() => {
    return self.streams().reduce((sum, s) => sum + s.heatLoad(), 0);
  });

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
  // Generate temperature intervals & heat loads
  self.calculateIntervals = function () {
    if (self.streams().length < 2 || isNaN(self.DTMin())) return;
    // clear intervals
    self.intervals([]);

    let coldStreamTemps = self.coldStreams().reduce((arr, s) => {
      arr.push(s.supplyTemp() + self.DTMin())
      arr.push(s.targetTemp() + self.DTMin())
      return arr
    }, []);

    let hotStreamTemps = self.hotStreams().reduce((arr, s) => {
      arr.push(s.supplyTemp());
      arr.push(s.targetTemp());
      return arr
    }, []);

    let temps = Array.from(
        new Set(
          coldStreamTemps.concat(hotStreamTemps)
        )
      )
      .sort((a,b) => a - b)
      .reverse();

    temps.forEach((t, i) => {
      if (i < temps.length - 1) {
        self.intervals.push(
          new Interval(self, i, t, temps[i + 1])
        )
      }
    });
    if (self.intervals().length > 1) self.calculateUtilities();
  }

  self.minHeatingUtility = ko.observable();
  self.minCoolingUtility = ko.observable();
  self.pinchTemperature = ko.observable();
  // Generate minimum cooling & heating utilities
  self.calculateUtilities = function () {
    let heatingUtil = 0;
    // Get heating util as largest deficit
    self.intervals().slice(1).reduce((prevInterval, i) => {
      let util = i.netHeatLoad() + prevInterval;
      if (util > heatingUtil) heatingUtil = util;
      return util;
    }, self.intervals()[0].netHeatLoad());

    // Get cooling util as surplus after heating util is included
    let coolingUtil = -self.intervals().reduce((prevInterval, i) => {
      if (prevInterval == 0) {
        self.pinchTemperature(
          (i.hotSideUpperTemp + i.coldSideUpperTemp) / 2
        );
      }
      return prevInterval + i.netHeatLoad();
    }, -heatingUtil);

    self.minHeatingUtility(heatingUtil);
    self.minCoolingUtility(coolingUtil);
  }

  self.load2StreamProblem = function () {
    self.streams([]);
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
  self.load4StreamProblem = function () {
    self.streams([]);
    self.addStream();
    self.addStream();
    self.addStream();
    self.addStream();
    let s1 = self.streams()[0];
    s1._supplyTemp(250);
    s1._targetTemp(120);
    s1._CP(1);
    let s2 = self.streams()[1];
    s2._supplyTemp(200);
    s2._targetTemp(100);
    s2._CP(4);
    let s3 = self.streams()[2];
    s3._supplyTemp(90);
    s3._targetTemp(150);
    s3._CP(3);
    let s4 = self.streams()[3];
    s4._supplyTemp(130);
    s4._targetTemp(190);
    s4._CP(6);
  }
}

let vm = new PinchViewModel();
ko.applyBindings(vm);
vm.load2StreamProblem();

// Convert a number to roman numerals
function romanize (num) {
  let lookup = {
    M:1000,CM:900,D:500,CD:400,C:100,XC:90,
    L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1
  },
  roman = '',
  i;
  for (i in lookup) {
    while (num >= lookup[i]) {
      roman += i;
      num -= lookup[i];
    }
  }
  return roman;
}
