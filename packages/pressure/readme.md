# @directus/pressure

Pressure based rate limiter

## Description

This package exports a pressure based rate limiter that is used within Directus, an open-source headless CMS.


## Installation

```
npm install @directus/pressure
```

## Usage

### Standalone

The pressure monitor is a class that can be used anywhere:

```js
import { PressureMonitor } from '@directus/pressure';

const monitor = new PressureMonitor({
	maxEventLoopUtilization: 0.8,
});

monitor.overloaded; // true | false
```

### Express

The library also exports an express middleware that can be used to throw an Error when the pressure monitor reports
overloaded:

```js
import express from 'express';
import { handlePressure } from '@directus/pressure';

const app = express();

app.use(
	handlePressure({
		maxEventLoopUtilization: 0.8,
	}),
);
```

## License

This package is licensed under the MIT License. See the
[LICENSE](https://github.com/ultra-mega-apps/directito/blob/main/packages/pressure/license) file for more information.

## Additional Resources

- [Directus GitHub Repository](https://github.com/ultra-mega-apps/directito)
