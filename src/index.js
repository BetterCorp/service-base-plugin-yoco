const ServiceBase = require("@bettercorp/service-base");

const SB = new (ServiceBase.default || ServiceBase)();
SB.init();
SB.run();