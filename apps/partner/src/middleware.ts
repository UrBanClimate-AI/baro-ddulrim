import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// 로그인 없이 접근 가능한 경로
const publicPaths = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/terms",
  "/privacy",
  "/third-party"
];
// 이미 로그인했다면 작업대로 보낼 경로
const redirectIfAuthed = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: { name: "sb-baro-partner-auth" },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = publicPaths.includes(path);

  // 비로그인 진입은 회원가입을 기본 화면으로 보여준다(신규 업체 온보딩 우선).
  if (!user && !isPublic) {
    const signupUrl = new URL("/signup", request.url);
    return NextResponse.redirect(signupUrl);
  }

  // 홈페이지 협력 제안으로 만들어진 계정(초기 비밀번호=연락처)은
  // 안전한 비밀번호로 바꾸기 전까지 비밀번호 변경 화면만 쓸 수 있다.
  if (
    user &&
    user.user_metadata?.must_change_password === true &&
    path !== "/change-password"
  ) {
    return NextResponse.redirect(new URL("/change-password", request.url));
  }

  if (user && redirectIfAuthed.includes(path)) {
    const homeUrl = new URL("/", request.url);
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
