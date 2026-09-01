fn main() {
    let _ = reqwest::Identity::from_pem(b"test");
}
