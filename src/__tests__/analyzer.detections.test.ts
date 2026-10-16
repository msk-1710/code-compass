import {
  describe,
  test,
  expect,
} from "@jest/globals";
import {
  detectReactComponentType,
  detectServerActions,
  detectNodeFramework,
  detectModuleSystem
} from "../analyzer";

describe('detectReactComponentType', () => {
  test('detects use client directive at top of file', () => {
    const code = `'use client';

import React from 'react';

export default function ClientComponent() {
  return <div>Client Component</div>;
}`;
    expect(detectReactComponentType(code)).toBe('client');
  });

  test('detects use client directive with double quotes', () => {
    const code = `"use client";

import React from 'react';

export default function ClientComponent() {
  return <div>Client Component</div>;
}`;
    expect(detectReactComponentType(code)).toBe('client');
  });

  test('detects use server directive at top of file', () => {
    const code = `'use server';

export async function serverAction() {
  // Server-side code
}`;
    expect(detectReactComponentType(code)).toBe('server');
  });

  test('detects use server directive with double quotes', () => {
    const code = `"use server";

export async function serverAction() {
  // Server-side code
}`;
    expect(detectReactComponentType(code)).toBe('server');
  });

  test('returns null for files without directives (shared components)', () => {
    const code = `import React from 'react';

export default function SharedComponent() {
  return <div>Shared Component</div>;
}`;
    expect(detectReactComponentType(code)).toBe(null);
  });

  test('ignores directives in single-line comments', () => {
    const code = `// 'use client';
import React from 'react';

export default function Component() {
  return <div>Component</div>;
}`;
    expect(detectReactComponentType(code)).toBe(null);
  });

  test('ignores directives in multi-line comments', () => {
    const code = `/*
 * 'use client';
 * This is a comment
 */
import React from 'react';

export default function Component() {
  return <div>Component</div>;
}`;
    expect(detectReactComponentType(code)).toBe(null);
  });

  test('detects directives in first 10 lines even after imports', () => {
    const code = `import React from 'react';

'use client';

export default function Component() {
  return <div>Component</div>;
}`;
    // The function checks first 10 lines, so this will be detected
    expect(detectReactComponentType(code)).toBe('client');
  });

  test('ignores directives after line 10', () => {
    const code = `import React from 'react';
import { useState } from 'react';
import { useEffect } from 'react';
import { useCallback } from 'react';
import { useMemo } from 'react';
import { useRef } from 'react';
import { useContext } from 'react';
import { createContext } from 'react';
import type { FC } from 'react';

'use client';

export default function Component() {
  return <div>Component</div>;
}`;
    // Directive is after line 10, so it won't be detected
    expect(detectReactComponentType(code)).toBe(null);
  });

  test('handles files with both directives (prioritizes first one)', () => {
    const code = `'use client';
'use server';

export default function Component() {
  return <div>Component</div>;
}`;
    expect(detectReactComponentType(code)).toBe('client');
  });

  test('handles empty files', () => {
    const code = '';
    expect(detectReactComponentType(code)).toBe(null);
  });

  test('handles files with only whitespace', () => {
    const code = '   \n\n  \n  ';
    expect(detectReactComponentType(code)).toBe(null);
  });

  test('detects directive with surrounding whitespace', () => {
    const code = `
    
'use client';

import React from 'react';`;
    expect(detectReactComponentType(code)).toBe('client');
  });
});

describe('detectServerActions', () => {
  test('detects export async function with use server', () => {
    const code = `export async function createUser(data) {
  'use server';
  // Server action code
}`;
    const result = detectServerActions(code);
    expect(result).toEqual(['createUser']);
  });

  test('detects async function with use server (not exported)', () => {
    const code = `async function updateUser(id, data) {
  'use server';
  // Server action code
}`;
    const result = detectServerActions(code);
    expect(result).toEqual(['updateUser']);
  });

  test('detects arrow functions with use server', () => {
    const code = `export const deleteUser = async (id) => {
  'use server';
  // Server action code
};`;
    const result = detectServerActions(code);
    expect(result).toEqual(['deleteUser']);
  });

  test('detects const arrow function with use server', () => {
    const code = `const submitForm = async (formData) => {
  'use server';
  // Server action code
};`;
    const result = detectServerActions(code);
    expect(result).toEqual(['submitForm']);
  });

  test('detects let arrow function with use server', () => {
    const code = `let processData = async (data) => {
  'use server';
  // Server action code
};`;
    const result = detectServerActions(code);
    expect(result).toEqual(['processData']);
  });

  test('detects var arrow function with use server', () => {
    const code = `var handleSubmit = async (data) => {
  'use server';
  // Server action code
};`;
    const result = detectServerActions(code);
    expect(result).toEqual(['handleSubmit']);
  });

  test('returns empty array when no server actions found', () => {
    const code = `export async function regularFunction() {
  // No 'use server' directive
  return data;
}`;
    const result = detectServerActions(code);
    expect(result).toEqual([]);
  });

  test('detects multiple server actions in one file', () => {
    const code = `export async function createUser(data) {
  'use server';
  // Create user
}

export async function updateUser(id, data) {
  'use server';
  // Update user
}

export const deleteUser = async (id) => {
  'use server';
  // Delete user
};`;
    const result = detectServerActions(code);
    expect(result).toEqual(['createUser', 'updateUser', 'deleteUser']);
  });

  test('ignores use server in single-line comments', () => {
    const code = `export async function myFunction() {
  // 'use server';
  return data;
}`;
    const result = detectServerActions(code);
    expect(result).toEqual([]);
  });

  test('ignores use server in multi-line comments', () => {
    const code = `export async function myFunction() {
  /*
   * 'use server';
   * This is commented out
   */
  return data;
}`;
    const result = detectServerActions(code);
    expect(result).toEqual([]);
  });

  test('handles malformed code gracefully', () => {
    const code = `export async function incomplete(
  // Missing closing brace and body
`;
    const result = detectServerActions(code);
    expect(result).toEqual([]);
  });

  test('handles empty file', () => {
    const code = '';
    const result = detectServerActions(code);
    expect(result).toEqual([]);
  });

  test('avoids duplicates from export async function', () => {
    const code = `export async function myAction(data) {
  'use server';
  return data;
}`;
    const result = detectServerActions(code);
    expect(result).toEqual(['myAction']);
    expect(result.length).toBe(1);
  });

  test('detects use server with double quotes', () => {
    const code = `export async function myAction(data) {
  "use server";
  return data;
}`;
    const result = detectServerActions(code);
    expect(result).toEqual(['myAction']);
  });
});

describe('detectNodeFramework', () => {
  test('detects Express.js with express() call', () => {
    const code = `import express from 'express';

const app = express();

app.listen(3000);`;
    expect(detectNodeFramework(code)).toBe('express');
  });

  test('detects Express.js with app.get() pattern', () => {
    const code = `const app = require('express')();

app.get('/', (req, res) => {
  res.send('Hello World');
});`;
    expect(detectNodeFramework(code)).toBe('express');
  });

  test('detects Express.js with app.post() pattern', () => {
    const code = `app.post('/api/users', (req, res) => {
  res.json({ success: true });
});`;
    expect(detectNodeFramework(code)).toBe('express');
  });

  test('detects Express.js with Router() pattern', () => {
    const code = `import { Router } from 'express';

const router = Router();

router.get('/users', handler);`;
    expect(detectNodeFramework(code)).toBe('express');
  });

  test('detects Express.js with express.Router() pattern', () => {
    const code = `const express = require('express');
const router = express.Router();`;
    expect(detectNodeFramework(code)).toBe('express');
  });

  test('detects Express.js with app.use() pattern', () => {
    const code = `app.use(express.json());
app.use('/api', apiRouter);`;
    expect(detectNodeFramework(code)).toBe('express');
  });

  test('detects NestJS with @Controller decorator', () => {
    const code = `import { Controller, Get } from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get()
  findAll() {
    return [];
  }
}`;
    expect(detectNodeFramework(code)).toBe('nestjs');
  });

  test('detects NestJS with @Injectable decorator', () => {
    const code = `import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  findAll() {
    return [];
  }
}`;
    expect(detectNodeFramework(code)).toBe('nestjs');
  });

  test('detects NestJS with @Module decorator', () => {
    const code = `import { Module } from '@nestjs/common';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}`;
    expect(detectNodeFramework(code)).toBe('nestjs');
  });

  test('detects NestJS with @Get decorator', () => {
    const code = `@Get(':id')
findOne(@Param('id') id: string) {
  return this.service.findOne(id);
}`;
    expect(detectNodeFramework(code)).toBe('nestjs');
  });

  test('detects NestJS with @Post decorator', () => {
    const code = `@Post()
create(@Body() dto: CreateDto) {
  return this.service.create(dto);
}`;
    expect(detectNodeFramework(code)).toBe('nestjs');
  });

  test('detects Fastify with fastify() call', () => {
    const code = `import fastify from 'fastify';

const app = fastify();

app.listen({ port: 3000 });`;
    expect(detectNodeFramework(code)).toBe('fastify');
  });

  test('detects Fastify with .register() pattern', () => {
    const code = `app.register(require('@fastify/cors'));
app.register(routes);`;
    expect(detectNodeFramework(code)).toBe('fastify');
  });

  test('detects Fastify with fastify. pattern', () => {
    const code = `const server = fastify.default();`;
    expect(detectNodeFramework(code)).toBe('fastify');
  });

  test('detects Fastify with import from fastify', () => {
    const code = `import Fastify from 'fastify';

const server = Fastify();`;
    expect(detectNodeFramework(code)).toBe('fastify');
  });

  test('detects Fastify with require fastify', () => {
    const code = `const fastify = require('fastify');

const app = fastify();`;
    expect(detectNodeFramework(code)).toBe('fastify');
  });

  test('returns null when no framework detected', () => {
    const code = `function myFunction() {
  return 'Hello World';
}`;
    expect(detectNodeFramework(code)).toBe(null);
  });

  test('prioritizes NestJS over Fastify when both patterns exist', () => {
    const code = `import { Controller } from '@nestjs/common';
import fastify from 'fastify';

@Controller()
export class MyController {}

const app = fastify();`;
    expect(detectNodeFramework(code)).toBe('nestjs');
  });

  test('prioritizes NestJS over Express when both patterns exist', () => {
    const code = `import { Controller } from '@nestjs/common';
import express from 'express';

@Controller()
export class MyController {}

const app = express();`;
    expect(detectNodeFramework(code)).toBe('nestjs');
  });

  test('prioritizes Fastify over Express when both patterns exist', () => {
    const code = `import fastify from 'fastify';
import express from 'express';

const fastifyApp = fastify();
const expressApp = express();`;
    expect(detectNodeFramework(code)).toBe('fastify');
  });

  test('handles imports correctly for Express', () => {
    const code = `import express from 'express';
import { Router } from 'express';

const app = express();`;
    expect(detectNodeFramework(code)).toBe('express');
  });

  test('ignores framework patterns in comments', () => {
    const code = `// const app = express();
/* 
 * @Controller()
 * const server = fastify();
 */
function myFunction() {
  return 'Hello';
}`;
    expect(detectNodeFramework(code)).toBe(null);
  });

  test('handles empty file', () => {
    const code = '';
    expect(detectNodeFramework(code)).toBe(null);
  });

  test('does not detect Express for Next.js useRouter() hook', () => {
    const code = `'use client';

import { useRouter } from 'next/navigation';

export default function MyComponent() {
  const router = useRouter();
  
  return <div>Component</div>;
}`;
    expect(detectNodeFramework(code)).toBe(null);
  });

  test('does not detect Express for Next.js Router import', () => {
    const code = `import { useRouter } from 'next/router';
import { usePathname } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  const pathname = usePathname();
  
  return <div>Page</div>;
}`;
    expect(detectNodeFramework(code)).toBe(null);
  });

  test('still detects Express in Next.js file with actual Express imports', () => {
    const code = `import express from 'express';
import { useRouter } from 'next/navigation';

const app = express();

app.get('/api/test', (req, res) => {
  res.json({ success: true });
});`;
    expect(detectNodeFramework(code)).toBe('express');
  });

  test('detects Express with express.Router() in non-Next.js file', () => {
    const code = `const express = require('express');
const router = express.Router();

router.get('/users', (req, res) => {
  res.json([]);
});`;
    expect(detectNodeFramework(code)).toBe('express');
  });

  test('detects Express with new Router() in non-Next.js file', () => {
    const code = `import { Router } from 'express';

const router = new Router();

router.post('/users', handler);`;
    expect(detectNodeFramework(code)).toBe('express');
  });

  test('does not detect Express for generic Router() call without Express context', () => {
    const code = `import { Router } from 'some-other-library';

const router = Router();

export default router;`;
    expect(detectNodeFramework(code)).toBe(null);
  });

  test('does not detect Fastify for React Hook Form register function', () => {
    const code = `'use client';

import { useForm } from 'react-hook-form';

export default function MyForm() {
  const { register, handleSubmit } = useForm();
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      <input {...register('password')} />
      <button type="submit">Submit</button>
    </form>
  );
}`;
    expect(detectNodeFramework(code)).toBe(null);
  });

  test('does not detect Fastify for React component with register from react-hook-form', () => {
    const code = `import React from 'react';
import { useForm } from 'react-hook-form';

export function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  
  const onSubmit = (data) => {
    console.log(data);
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('username', { required: true })} />
      {errors.username && <span>This field is required</span>}
      <button type="submit">Login</button>
    </form>
  );
}`;
    expect(detectNodeFramework(code)).toBe(null);
  });

  test('does not detect Fastify for Next.js component with register', () => {
    const code = `import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';

export default function ContactForm() {
  const router = useRouter();
  const { register, handleSubmit } = useForm();
  
  return (
    <form onSubmit={handleSubmit(() => router.push('/success'))}>
      <input {...register('name')} />
      <button type="submit">Submit</button>
    </form>
  );
}`;
    expect(detectNodeFramework(code)).toBe(null);
  });

  test('still detects Fastify with actual fastify.register() in non-React file', () => {
    const code = `const fastify = require('fastify')();

fastify.register(require('@fastify/cors'));
fastify.register(require('./routes'));

fastify.listen({ port: 3000 });`;
    expect(detectNodeFramework(code)).toBe('fastify');
  });

  test('still detects Fastify with app.register() in non-React file', () => {
    const code = `import Fastify from 'fastify';

const app = Fastify();

app.register(import('./plugins/sensible'));
app.register(import('./routes/users'));

export default app;`;
    expect(detectNodeFramework(code)).toBe('fastify');
  });

  test('still detects Fastify with server.register() in non-React file', () => {
    const code = `const server = require('fastify')();

server.register(require('@fastify/helmet'));

module.exports = server;`;
    expect(detectNodeFramework(code)).toBe('fastify');
  });
});

describe('detectModuleSystem', () => {
  test('detects CommonJS with require()', () => {
    const code = `const express = require('express');
const utils = require('./utils');`;
    expect(detectModuleSystem(code)).toBe('commonjs');
  });

  test('detects CommonJS with module.exports', () => {
    const code = `function myFunction() {
  return 'Hello';
}

module.exports = myFunction;`;
    expect(detectModuleSystem(code)).toBe('commonjs');
  });

  test('detects CommonJS with exports.', () => {
    const code = `exports.myFunction = function() {
  return 'Hello';
};

exports.myValue = 42;`;
    expect(detectModuleSystem(code)).toBe('commonjs');
  });

  test('detects ES Modules with import', () => {
    const code = `import React from 'react';
import { useState } from 'react';`;
    expect(detectModuleSystem(code)).toBe('esm');
  });

  test('detects ES Modules with export', () => {
    const code = `export function myFunction() {
  return 'Hello';
}

export const myValue = 42;`;
    expect(detectModuleSystem(code)).toBe('esm');
  });

  test('detects ES Modules with export default', () => {
    const code = `function MyComponent() {
  return <div>Hello</div>;
}

export default MyComponent;`;
    expect(detectModuleSystem(code)).toBe('esm');
  });

  test('detects mixed module system (both CommonJS and ESM)', () => {
    const code = `import React from 'react';

const utils = require('./utils');

export default function Component() {
  return <div>Hello</div>;
}`;
    expect(detectModuleSystem(code)).toBe('mixed');
  });

  test('detects mixed with module.exports and import', () => {
    const code = `import { something } from './module';

module.exports = {
  myFunction: () => {}
};`;
    expect(detectModuleSystem(code)).toBe('mixed');
  });

  test('detects mixed with exports. and import', () => {
    const code = `import React from 'react';

exports.myValue = 42;`;
    expect(detectModuleSystem(code)).toBe('mixed');
  });

  test('returns null for files with neither module system', () => {
    const code = `function myFunction() {
  return 'Hello World';
}

const value = 42;`;
    expect(detectModuleSystem(code)).toBe(null);
  });

  test('ignores require in single-line comments', () => {
    const code = `// const utils = require('./utils');

function myFunction() {
  return 'Hello';
}`;
    expect(detectModuleSystem(code)).toBe(null);
  });

  test('ignores require in multi-line comments', () => {
    const code = `/*
 * const utils = require('./utils');
 * module.exports = something;
 */

function myFunction() {
  return 'Hello';
}`;
    expect(detectModuleSystem(code)).toBe(null);
  });

  test('ignores import in single-line comments', () => {
    const code = `// import React from 'react';

function myFunction() {
  return 'Hello';
}`;
    expect(detectModuleSystem(code)).toBe(null);
  });

  test('ignores export in multi-line comments', () => {
    const code = `/*
 * export default MyComponent;
 * export const value = 42;
 */

function myFunction() {
  return 'Hello';
}`;
    expect(detectModuleSystem(code)).toBe(null);
  });

  test('handles empty file', () => {
    const code = '';
    expect(detectModuleSystem(code)).toBe(null);
  });

  test('handles file with only whitespace', () => {
    const code = '   \n\n  \n  ';
    expect(detectModuleSystem(code)).toBe(null);
  });

  test('detects CommonJS with destructured require', () => {
    const code = `const { readFile, writeFile } = require('fs');`;
    expect(detectModuleSystem(code)).toBe('commonjs');
  });

  test('detects ESM with named exports', () => {
    const code = `export { myFunction, myValue };`;
    expect(detectModuleSystem(code)).toBe('esm');
  });

  test('detects ESM with re-exports', () => {
    const code = `export * from './module';
export { default as MyComponent } from './Component';`;
    expect(detectModuleSystem(code)).toBe('esm');
  });

  test('detects ESM with type imports', () => {
    const code = `import type { User } from './types';`;
    expect(detectModuleSystem(code)).toBe('esm');
  });

  test('detects ESM with type exports', () => {
    const code = `export type { User, Product };`;
    expect(detectModuleSystem(code)).toBe('esm');
  });
});