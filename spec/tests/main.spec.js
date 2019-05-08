"use strict";

const supertest = require("supertest");
const Tester = require("@oracle/bots-node-sdk/testing");
describe('Custom Component Service', () => {
  // server setup
  let server;
  beforeAll(() => server = require('../../index'));
  afterAll(done => server.close(() => done()));

  it('should GET component metadata', done => {
    supertest(server)
      .get('/components')
      .expect(200)
      .expect(res => {
        expect(res.body.version).toBeTruthy(`response did not contain metadata version`);
      }).end(err => err ? done.fail(err) : done());
  });

  it('should POST to invoke a component', done => {
    supertest(server)
      .post('/components/hello.world')
      .send(Tester.MockRequest())
      .expect(200)
      .expect(res => {
        expect(res.body).toEqual(jasmine.any(Object));
        expect(res.body.error).toBe(false);
      }).end(err => err ? done.fail(err) : done());
  });

});
