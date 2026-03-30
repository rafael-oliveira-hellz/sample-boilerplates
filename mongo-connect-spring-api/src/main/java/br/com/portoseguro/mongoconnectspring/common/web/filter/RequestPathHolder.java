package br.com.portoseguro.mongoconnectspring.common.web.filter;

public final class RequestPathHolder {

    private static final ThreadLocal<String> PATH = new ThreadLocal<>();

    private RequestPathHolder() {
    }

    public static void set(String path) {
        PATH.set(path);
    }

    public static String get() {
        return PATH.get();
    }

    public static void clear() {
        PATH.remove();
    }
}
