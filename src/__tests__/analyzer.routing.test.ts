import {
  detectRouteGroup,
  detectDynamicSegments,
  detectParallelRoute,
  detectInterceptingRoute,
  detectHTTPMethods,
  trackDynamicImports,
} from '../analyzer';

describe('Next.js Routing Detection', () => {
  describe('detectRouteGroup', () => {
    it('should detect route groups in paths', () => {
      expect(detectRouteGroup('app/(auth)/login/page.tsx')).toBe('auth');
      expect(detectRouteGroup('app/(marketing)/about/page.tsx')).toBe('marketing');
      expect(detectRouteGroup('app/(dashboard)/settings/page.tsx')).toBe('dashboard');
    });

    it('should return the last route group when nested', () => {
      // Returns the last (most specific/innermost) route group
      expect(detectRouteGroup('app/(auth)/(forms)/login/page.tsx')).toBe('auth');
    });

    it('should return null for paths without route groups', () => {
      expect(detectRouteGroup('app/about/page.tsx')).toBeNull();
      expect(detectRouteGroup('src/components/Button.tsx')).toBeNull();
    });

    it('should handle Windows path separators', () => {
      expect(detectRouteGroup('app\\(auth)\\login\\page.tsx')).toBe('auth');
    });

    it('should detect nested route groups with multiple levels', () => {
      // Returns the last (most specific/innermost) route group if multiple exist
      expect(detectRouteGroup('app/(auth)/(protected)/admin/page.tsx')).toBe('auth');
    });

    it('should handle route groups with special characters', () => {
      expect(detectRouteGroup('app/(auth-flow)/login/page.tsx')).toBe('auth-flow');
      expect(detectRouteGroup('app/(user_dashboard)/settings/page.tsx')).toBe('user_dashboard');
    });

    it('should handle malformed route groups', () => {
      expect(detectRouteGroup('app/(incomplete/page.tsx')).toBeNull();
      expect(detectRouteGroup('app/incomplete)/page.tsx')).toBeNull();
      expect(detectRouteGroup('app/()/page.tsx')).toBeNull();
    });
  });

  describe('detectDynamicSegments', () => {
    it('should detect single dynamic segments', () => {
      const result = detectDynamicSegments('app/blog/[slug]/page.tsx');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: 'slug', type: 'single' });
    });

    it('should detect catch-all segments', () => {
      const result = detectDynamicSegments('app/docs/[...path]/page.tsx');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: 'path', type: 'catch-all' });
    });

    it('should detect optional catch-all segments', () => {
      const result = detectDynamicSegments('app/shop/[[...categories]]/page.tsx');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: 'categories', type: 'optional-catch-all' });
    });

    it('should detect multiple dynamic segments', () => {
      const result = detectDynamicSegments('app/blog/[category]/[slug]/page.tsx');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: 'category', type: 'single' });
      expect(result[1]).toEqual({ name: 'slug', type: 'single' });
    });

    it('should return empty array for paths without dynamic segments', () => {
      expect(detectDynamicSegments('app/about/page.tsx')).toEqual([]);
    });

    it('should handle Windows path separators', () => {
      const result = detectDynamicSegments('app\\blog\\[slug]\\page.tsx');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ name: 'slug', type: 'single' });
    });

    it('should detect multiple dynamic segments in complex paths', () => {
      const result = detectDynamicSegments('app/[lang]/blog/[category]/[slug]/page.tsx');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ name: 'lang', type: 'single' });
      expect(result[1]).toEqual({ name: 'category', type: 'single' });
      expect(result[2]).toEqual({ name: 'slug', type: 'single' });
    });

    it('should handle mixed dynamic segment types', () => {
      const result = detectDynamicSegments('app/[lang]/docs/[...path]/page.tsx');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: 'lang', type: 'single' });
      expect(result[1]).toEqual({ name: 'path', type: 'catch-all' });
    });

    it('should handle dynamic segments with special characters', () => {
      const result = detectDynamicSegments('app/[user_id]/posts/[post-id]/page.tsx');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ name: 'user_id', type: 'single' });
      expect(result[1]).toEqual({ name: 'post-id', type: 'single' });
    });

    it('should handle malformed dynamic segments', () => {
      expect(detectDynamicSegments('app/[incomplete/page.tsx')).toEqual([]);
      expect(detectDynamicSegments('app/incomplete]/page.tsx')).toEqual([]);
      expect(detectDynamicSegments('app/[]/page.tsx')).toEqual([]);
    });
  });

  describe('detectParallelRoute', () => {
    it('should detect parallel routes', () => {
      expect(detectParallelRoute('app/@modal/login/page.tsx')).toBe('modal');
      expect(detectParallelRoute('app/@sidebar/settings/page.tsx')).toBe('sidebar');
      expect(detectParallelRoute('app/@analytics/dashboard/page.tsx')).toBe('analytics');
    });

    it('should return the first parallel route when nested', () => {
      // Returns the first (outermost) parallel route
      expect(detectParallelRoute('app/@modal/@nested/page.tsx')).toBe('modal');
    });

    it('should return null for paths without parallel routes', () => {
      expect(detectParallelRoute('app/about/page.tsx')).toBeNull();
      expect(detectParallelRoute('src/components/Modal.tsx')).toBeNull();
    });

    it('should handle Windows path separators', () => {
      expect(detectParallelRoute('app\\@modal\\login\\page.tsx')).toBe('modal');
    });

    it('should detect parallel routes with special characters', () => {
      expect(detectParallelRoute('app/@user-profile/settings/page.tsx')).toBe('user-profile');
      expect(detectParallelRoute('app/@nav_bar/page.tsx')).toBe('nav_bar');
    });

    it('should handle malformed parallel routes', () => {
      // Empty slot name after @ returns empty string
      expect(detectParallelRoute('app/@/page.tsx')).toBeNull();
      // Double @@ is treated as a slot named '@modal'
      expect(detectParallelRoute('app/@@modal/page.tsx')).toBe('@modal');
    });
  });

  describe('detectInterceptingRoute', () => {
    it('should detect same-level intercepting routes', () => {
      const result = detectInterceptingRoute('app/feed/(.)/photo/page.tsx');
      expect(result).toEqual({
        type: 'same-level',
        target: 'photo/page.tsx',
      });
    });

    it('should detect one-level-up intercepting routes', () => {
      const result = detectInterceptingRoute('app/feed/(..)/photo/[id]/page.tsx');
      expect(result).toEqual({
        type: 'one-up',
        target: 'photo/[id]/page.tsx',
      });
    });

    it('should detect two-levels-up intercepting routes with (...)', () => {
      const result = detectInterceptingRoute('app/feed/(...)/photo/page.tsx');
      expect(result).toEqual({
        type: 'two-up',
        target: 'photo/page.tsx',
      });
    });

    it('should detect two-levels-up intercepting routes with (..)(..)', () => {
      const result = detectInterceptingRoute('app/feed/(..)(..)/photo/page.tsx');
      expect(result).toEqual({
        type: 'two-up',
        target: 'photo/page.tsx',
      });
    });

    it('should detect root-level intercepting routes', () => {
      const result = detectInterceptingRoute('app/feed/(....)/photo/page.tsx');
      expect(result).toEqual({
        type: 'root',
        target: 'photo/page.tsx',
      });
    });

    it('should return null for paths without intercepting routes', () => {
      expect(detectInterceptingRoute('app/about/page.tsx')).toBeNull();
    });

    it('should handle Windows path separators', () => {
      const result = detectInterceptingRoute('app\\feed\\(..)\\photo\\page.tsx');
      expect(result).toEqual({
        type: 'one-up',
        target: 'photo/page.tsx',
      });
    });

    it('should detect complex intercepting routes with multiple levels', () => {
      const result = detectInterceptingRoute('app/feed/(..)(..)/photo/[id]/page.tsx');
      expect(result).toEqual({
        type: 'two-up',
        target: 'photo/[id]/page.tsx',
      });
    });

    it('should handle intercepting routes with dynamic segments', () => {
      const result = detectInterceptingRoute('app/feed/(.)/photo/[id]/[variant]/page.tsx');
      expect(result).toEqual({
        type: 'same-level',
        target: 'photo/[id]/[variant]/page.tsx',
      });
    });

    it('should handle intercepting routes at the end of path', () => {
      const result = detectInterceptingRoute('app/feed/(..)/page.tsx');
      expect(result).toEqual({
        type: 'one-up',
        target: 'page.tsx',
      });
    });

    it('should handle malformed intercepting routes', () => {
      expect(detectInterceptingRoute('app/feed/(../photo/page.tsx')).toBeNull();
      expect(detectInterceptingRoute('app/feed/..)/photo/page.tsx')).toBeNull();
    });
  });

  describe('detectHTTPMethods', () => {
    it('should detect async function exports', () => {
      const content = `
        export async function GET(request: Request) {
          return Response.json({ data: 'test' });
        }
        
        export async function POST(request: Request) {
          return Response.json({ success: true });
        }
      `;
      const methods = detectHTTPMethods(content);
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toHaveLength(2);
    });

    it('should detect regular function exports', () => {
      const content = `
        export function GET(request: Request) {
          return Response.json({ data: 'test' });
        }
      `;
      const methods = detectHTTPMethods(content);
      expect(methods).toContain('GET');
    });

    it('should detect const arrow function exports', () => {
      const content = `
        export const GET = async (request: Request) => {
          return Response.json({ data: 'test' });
        };
        
        export const DELETE = (req: Request) => {
          return new Response(null, { status: 204 });
        };
      `;
      const methods = detectHTTPMethods(content);
      expect(methods).toContain('GET');
      expect(methods).toContain('DELETE');
    });

    it('should detect const function expression exports', () => {
      const content = `
        export const PATCH = function(request: Request) {
          return Response.json({ updated: true });
        };
      `;
      const methods = detectHTTPMethods(content);
      expect(methods).toContain('PATCH');
    });

    it('should detect all HTTP methods', () => {
      const content = `
        export async function GET(req: Request) {}
        export async function POST(req: Request) {}
        export async function PUT(req: Request) {}
        export async function DELETE(req: Request) {}
        export async function PATCH(req: Request) {}
        export async function OPTIONS(req: Request) {}
        export async function HEAD(req: Request) {}
      `;
      const methods = detectHTTPMethods(content);
      expect(methods).toEqual(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']);
    });

    it('should ignore methods in comments', () => {
      const content = `
        // export async function GET(request: Request) {}
        /* export async function POST(request: Request) {} */
        
        export async function DELETE(request: Request) {
          return new Response(null, { status: 204 });
        }
      `;
      const methods = detectHTTPMethods(content);
      expect(methods).toEqual(['DELETE']);
    });

    it('should return empty array when no HTTP methods found', () => {
      const content = `
        export default function Page() {
          return <div>Hello</div>;
        }
      `;
      const methods = detectHTTPMethods(content);
      expect(methods).toEqual([]);
    });

    it('should not detect non-exported functions', () => {
      const content = `
        async function GET(request: Request) {
          return Response.json({ data: 'test' });
        }
      `;
      const methods = detectHTTPMethods(content);
      expect(methods).toEqual([]);
    });

    it('should handle mixed export styles in one file', () => {
      const content = `
        export async function GET(req: Request) {
          return Response.json({ data: 'test' });
        }
        
        export const POST = async (req: Request) => {
          return Response.json({ success: true });
        };
        
        export const PUT = function(req: Request) {
          return Response.json({ updated: true });
        };
      `;
      const methods = detectHTTPMethods(content);
      expect(methods).toEqual(['GET', 'POST', 'PUT']);
    });

    it('should handle methods with TypeScript types', () => {
      const content = `
        export async function GET(
          request: Request,
          context: { params: { id: string } }
        ): Promise<Response> {
          return Response.json({ id: context.params.id });
        }
      `;
      const methods = detectHTTPMethods(content);
      expect(methods).toContain('GET');
    });

    it('should ignore methods in multiline comments', () => {
      const content = `
        /*
         * This is a comment
         * export async function GET(request: Request) {}
         * export async function POST(request: Request) {}
         */
        
        export async function DELETE(request: Request) {
          return new Response(null, { status: 204 });
        }
      `;
      const methods = detectHTTPMethods(content);
      expect(methods).toEqual(['DELETE']);
    });
  });

  describe('Integration: Complex Next.js paths', () => {
    it('should detect multiple features in a single path', () => {
      // Note: Intercepting routes should be separate directories, not combined with route groups
      const path = 'app/(dashboard)/@modal/settings/[id]/page.tsx';
      
      expect(detectRouteGroup(path)).toBe('dashboard');
      expect(detectParallelRoute(path)).toBe('modal');
      expect(detectDynamicSegments(path)).toEqual([
        { name: 'id', type: 'single' },
      ]);
    });

    it('should handle complex nested structures', () => {
      const path = 'app/(auth)/(forms)/login/[...params]/page.tsx';
      
      // Returns the first (outermost) route group
      expect(detectRouteGroup(path)).toBe('auth');
      expect(detectDynamicSegments(path)).toEqual([
        { name: 'params', type: 'catch-all' },
      ]);
    });

    it('should detect intercepting routes separately', () => {
      const path = 'app/feed/(..)/photo/[id]/page.tsx';
      
      expect(detectInterceptingRoute(path)).toEqual({
        type: 'one-up',
        target: 'photo/[id]/page.tsx',
      });
      expect(detectDynamicSegments(path)).toEqual([
        { name: 'id', type: 'single' },
      ]);
    });
  });
});