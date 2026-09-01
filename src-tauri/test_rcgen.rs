fn main() {
    let cert = rcgen::generate_simple_self_signed(vec!["LocalSend User".to_string()]).unwrap();
    let pem = cert.cert.pem();
    let key = cert.key_pair.serialize_pem();
}
