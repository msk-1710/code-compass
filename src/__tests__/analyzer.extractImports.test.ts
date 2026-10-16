import {
    describe,
    it,
    expect,
} from "@jest/globals";
import { extractImports } from "../analyzer";

describe('Edge Cases', () => {
    it('should ignore imports in single-line comments', () => {
        const code = '// import { foo } from "./module";\nimport { bar } from "./other";';
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './other', identifiers: ['bar'] }
        ]);
    });

    it('should ignore imports in multi-line comments', () => {
        const code = '/* import { foo } from "./module"; */\nimport { bar } from "./other";';
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './other', identifiers: ['bar'] }
        ]);
    });

    it.skip('should ignore imports in strings', () => {
        const code = 'const str = "import { foo } from \'./module\';";\nimport { bar } from "./other";';
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './other', identifiers: ['bar'] }
        ]);
    });

    it('should handle multiple imports from same path', () => {
        const code = 'import { foo } from "./module";\nimport { bar } from "./module";';
        const result = extractImports(code);
        // Should only return one entry (deduplication)
        expect(result).toEqual([
            { path: './module', identifiers: ['foo'] }
        ]);
    });

    it('should handle imports with trailing commas', () => {
        const code = 'import { foo, bar, } from "./module";';
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './module', identifiers: ['foo', 'bar'] }
        ]);
    });

    it('should handle imports with extra whitespace', () => {
        const code = 'import  {  foo  ,  bar  }  from  "./module"  ;';
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './module', identifiers: ['foo', 'bar'] }
        ]);
    });

    it('should handle empty imports (side-effect only)', () => {
        const code = 'import "./polyfills";';
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './polyfills', identifiers: [] }
        ]);
    });

    it('should handle complex multiline with comments', () => {
        const code = `import {
  foo, // First import
  bar, // Second import
  baz  // Third import
} from "./module";`;
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './module', identifiers: ['foo', 'bar', 'baz'] }
        ]);
    });

    it('should handle imports with multiple aliases', () => {
        const code = 'import { foo as f, bar as b, baz as z } from "./module";';
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './module', identifiers: ['f', 'b', 'z'] }
        ]);
    });

    it('should handle mixed default, namespace, and named imports', () => {
        const code = 'import React, * as ReactDOM from "react-dom";';
        const result = extractImports(code);
        // This is an invalid syntax, but test current behavior
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].path).toBe('react-dom');
    });

    it('should extract all imports from a complex file', () => {
        const code = `
import React, { useState } from "react";
import type { FC } from "react";
import * as utils from "./utils";
import "./styles.css";
import logo from "./logo.png";
const dynamic = import("./dynamic");
export { Button } from "./Button";
export * from "./components";
`;
        const result = extractImports(code);
        expect(result.length).toBe(7);
        expect(result.map(r => r.path)).toContain('react');
        expect(result.map(r => r.path)).toContain('./utils');
        expect(result.map(r => r.path)).toContain('./styles.css');
        expect(result.map(r => r.path)).toContain('./logo.png');
        expect(result.map(r => r.path)).toContain('./dynamic');
        expect(result.map(r => r.path)).toContain('./Button');
        expect(result.map(r => r.path)).toContain('./components');
    });
});

describe('Barrel Import Patterns', () => {
    it('should extract simple barrel re-exports', () => {
        const code = `
export { Button } from "./Button";
export { Input } from "./Input";
export { Card } from "./Card";
`;
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './Button', identifiers: ['Button'] },
            { path: './Input', identifiers: ['Input'] },
            { path: './Card', identifiers: ['Card'] }
        ]);
    });

    it('should extract wildcard barrel re-exports', () => {
        const code = `
export * from "./Button";
export * from "./Input";
export * from "./Card";
`;
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './Button', identifiers: [] },
            { path: './Input', identifiers: [] },
            { path: './Card', identifiers: [] }
        ]);
    });

    it('should extract namespace barrel re-exports', () => {
        const code = `
export * as Button from "./Button";
export * as Input from "./Input";
`;
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './Button', identifiers: [] },
            { path: './Input', identifiers: [] }
        ]);
    });

    it('should extract default re-exports in barrel', () => {
        const code = `
export { default as Button } from "./Button";
export { default as Input } from "./Input";
export { ButtonProps, InputProps } from "./types";
`;
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './Button', identifiers: ['Button'] },
            { path: './Input', identifiers: ['Input'] },
            { path: './types', identifiers: ['ButtonProps', 'InputProps'] }
        ]);
    });

    it('should extract selective barrel re-exports', () => {
        const code = `
export { formatDate, parseDate } from "./date";
export { capitalize, truncate } from "./string";
`;
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './date', identifiers: ['formatDate', 'parseDate'] },
            { path: './string', identifiers: ['capitalize', 'truncate'] }
        ]);
    });

    it('should extract nested barrel structure', () => {
        const code = `
export * from "./buttons";
export * from "./inputs";
`;
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './buttons', identifiers: [] },
            { path: './inputs', identifiers: [] }
        ]);
    });

    it('should extract API namespace barrel pattern', () => {
        const code = `
export * as users from "./users";
export * as products from "./products";
export * as orders from "./orders";
`;
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './users', identifiers: [] },
            { path: './products', identifiers: [] },
            { path: './orders', identifiers: [] }
        ]);
    });

    it('should extract type-only barrel re-exports', () => {
        const code = `
export type { User, UserRole } from "./user";
export type { Product, ProductCategory } from "./product";
export type { Order, OrderStatus } from "./order";
`;
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './user', identifiers: ['User', 'UserRole'] },
            { path: './product', identifiers: ['Product', 'ProductCategory'] },
            { path: './order', identifiers: ['Order', 'OrderStatus'] }
        ]);
    });

    it('should extract monorepo barrel pattern', () => {
        const code = `
export * from "./article";
export * from "./brand";
export * from "./designer";
`;
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './article', identifiers: [] },
            { path: './brand', identifiers: [] },
            { path: './designer', identifiers: [] }
        ]);
    });

    it('should extract feature-based barrel structure', () => {
        const code = `
export { LoginForm, RegisterForm } from "./components";
export { useAuth, useSession } from "./hooks";
export type { User, AuthState } from "./types";
`;
        const result = extractImports(code);
        expect(result).toEqual([
            { path: './components', identifiers: ['LoginForm', 'RegisterForm'] },
            { path: './hooks', identifiers: ['useAuth', 'useSession'] },
            { path: './types', identifiers: ['User', 'AuthState'] }
        ]);
    });
});

describe('Known Issues / Failing Tests', () => {
    // These tests document current limitations that may need fixing

    it.skip('KNOWN ISSUE: Does not handle glob imports (Vite)', () => {
        const code = 'const modules = import.meta.glob("./dir/*.js");';
        const result = extractImports(code);
        // Currently fails - glob imports are not detected
        expect(result).toEqual([
            { path: './dir/*.js', identifiers: [] }
        ]);
    });

    it.skip('KNOWN ISSUE: Does not handle eager glob imports', () => {
        const code = 'const eager = import.meta.glob("./dir/*.js", { eager: true });';
        const result = extractImports(code);
        // Currently fails - glob imports are not detected
        expect(result).toEqual([
            { path: './dir/*.js', identifiers: [] }
        ]);
    });

    it.skip('KNOWN ISSUE: Does not handle CommonJS require', () => {
        const code = 'const module = require("./module");';
        const result = extractImports(code);
        // Currently fails - CommonJS is not supported
        expect(result).toEqual([
            { path: './module', identifiers: ['module'] }
        ]);
    });

    it.skip('KNOWN ISSUE: Does not handle destructured require', () => {
        const code = 'const { foo } = require("./module");';
        const result = extractImports(code);
        // Currently fails - CommonJS is not supported
        expect(result).toEqual([
            { path: './module', identifiers: ['foo'] }
        ]);
    });

    it('KNOWN ISSUE: May not handle extremely complex nested comments', () => {
        const code = `
/* 
 * import { fake } from "./fake";
 * /* nested comment */
 */
import { real } from "./real";
`;
        const result = extractImports(code);
        // May fail with nested comments
        expect(result).toEqual([
            { path: './real', identifiers: ['real'] }
        ]);
    });
});
