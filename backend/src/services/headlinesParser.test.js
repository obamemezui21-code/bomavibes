const test = require("node:test");
const assert = require("node:assert/strict");
const { HEADLINES_COUNT, parseHeadlines } = require("./headlinesParser");

const IMAGE = "http://gouvernement.ga/wp-content/uploads/2026/11/photo.jpeg";
const post = (changes = {}) => ({
    id: 101,
    date_gmt: "2026-11-02T14:50:06",
    link: "http://gouvernement.ga/2026/11/02/article/",
    title: { rendered: "BUDGET 2027&nbsp;: L&rsquo;&Eacute;TAT &#8211; <em>RENFORCE</em>" },
    _embedded: {
        "wp:featuredmedia": [{ source_url: IMAGE }],
        "wp:term": [
            [{ taxonomy: "category", name: "Actualit&eacute;s" }, { taxonomy: "category", name: "Minist&egrave;re de l&rsquo;Agriculture" }],
            [{ taxonomy: "post_tag", name: "Gabon" }],
        ],
    },
    ...changes,
});

test("an article gives a clean slide, in https, its date in UTC", () => {
    const [slide] = parseHeadlines([post()]);
    assert.equal(slide.title, "BUDGET 2027 : L’ÉTAT – RENFORCE");
    assert.equal(slide.url, "https://gouvernement.ga/2026/11/02/article/");
    assert.equal(slide.imageUrl, "https://gouvernement.ga/wp-content/uploads/2026/11/photo.jpeg");
    assert.equal(slide.source, "Gouvernement.ga");
    assert.equal(slide.publishedAt, "2026-11-02T14:50:06.000Z");
});

test("names the ministry rather than the general category", () => {
    assert.equal(parseHeadlines([post()])[0].category, "Ministère de l’Agriculture");
    const general = post({ _embedded: { "wp:featuredmedia": [{ source_url: IMAGE }], "wp:term": [[{ taxonomy: "category", name: "Actualit&eacute;s" }]] } });
    assert.equal(parseHeadlines([general])[0].category, "Actualités");
});

test("keeps the latest articles only, in the feed's order", () => {
    const posts = Array.from({ length: 15 }, (_, i) => post({ id: i + 1 }));
    const slides = parseHeadlines(posts);
    assert.equal(slides.length, HEADLINES_COUNT);
    assert.equal(HEADLINES_COUNT, 9);
    assert.deepEqual(slides.map((s) => s.id), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("skips an article without a photo or a title, and fills up with the next", () => {
    const slides = parseHeadlines([
        post({ id: 1, _embedded: {} }),
        post({ id: 2, title: { rendered: "  " } }),
        post({ id: 3 }),
    ]);
    assert.deepEqual(slides.map((s) => s.id), [3]);
});

test("refuses links and photos that aren't really on gouvernement.ga", () => {
    const hostile = [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "ftp://gouvernement.ga/file",
        "https://gouvernement.ga.evil.example/fake/",
        "http://evil.example/gouvernement.ga/",
        "https://gouvernement.ga@evil.example/",
        "https://fakegouvernement.ga/",
        "not a url",
        null,
    ];
    for (const link of hostile) assert.deepEqual(parseHeadlines([post({ link })]), [], `link: ${link}`);
    for (const source_url of hostile) {
        assert.deepEqual(parseHeadlines([post({ _embedded: { "wp:featuredmedia": [{ source_url }] } })]), [], `image: ${source_url}`);
    }
    assert.equal(parseHeadlines([post({ link: "https://www.gouvernement.ga/a/" })]).length, 1);
});

test("survives an answer that isn't what was expected", () => {
    for (const answer of [null, undefined, {}, "oops", 12]) assert.deepEqual(parseHeadlines(answer), []);
    assert.deepEqual(parseHeadlines([null, {}, { id: "x" }]), []);
});

test("still gives a slide with no category or date", () => {
    const [slide] = parseHeadlines([post({ date_gmt: null, _embedded: { "wp:featuredmedia": [{ source_url: IMAGE }] } })]);
    assert.equal(slide.category, "Actualités");
    assert.equal(slide.publishedAt, null);
});
