<?php
require 'login_free.php';

if (array_key_exists('push',$_POST))	{	// Master mode, updates database with new hash
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	if (!pg_meta_data($dbconn,'slides')) {
		$query="create table slides (name varchar(30) primary key,hash varchar(50))";
		$result=pg_query($query) or die('Request failded: '.pg_last_error());
		pg_free_result($result);
		$query="create or replace function notify_slides() returns trigger as $$
			begin
				perform pg_notify(old.name,new.hash);
				return new;
			end;
			$$ language plpgsql;";
		$result=pg_query($query) or die('Request failded: '.pg_last_error());
		pg_free_result($result);
		$query="create trigger notify_update after update on slides for each row execute procedure notify_slides()";
		$result=pg_query($query) or die('Request failded: '.pg_last_error());
		pg_free_result($result);
	}
	$query="select * from slides where name='".$_POST['push']."'";
	$result=pg_query($query);
	if (pg_num_rows($result)==0) {
		pg_free_result($result);
		$query="insert into slides values ('".$_POST['push']."','".$_POST['hash']."')";
		$result=pg_query($query) or die ('Request failed: '.pg_last_error());
	} else {
		pg_free_result($result);
		$query="update slides set hash='".$_POST['hash']."' where name='".$_POST['push']."'";
		$result=pg_query($query) or die ('Request failed: '.pg_last_error());
	}
	pg_free_result($result);
	pg_close($dbconn);
} elseif (array_key_exists('register',$_GET)) {	// Slave mode with HTML5 server-sent events, connection kept alive, changes in database are immediatly sent to client
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	header('Content-Type: text/event-stream');
	header('Cache-Control: no-cache');
	ob_end_clean();
	$query='listen '.$_GET['register'];
	$result=pg_query($query) or die('Request failed: '.pg_last_error());
	register_shutdown_function(function($dbconn,$result) {
		pg_free_result($result);
		pg_close($dbconn);
	},$dbconn,$result);
	do {
		$notify=pg_get_notify($dbconn,PGSQL_NUM);
		if ($notify) {
			$query="select hash from slides where name='".$_GET['register']."'";
			$res=pg_query($query) or die('Request failed: '.pg_last_error());
			$val=pg_fetch_array($res,null,PGSQL_ASSOC);
			pg_free_result($res);
			if ($val) {
				echo 'data: '.$val['hash'].PHP_EOL;
				echo PHP_EOL;
				flush();
			}
		}
		sleep(1);
	} while (true);
	pg_free_result($result);
	pg_close($dbconn);
} elseif (array_key_exists('pull',$_POST)) {	// Slave mode with no HTML5 server-sent events, client has to poll at regular intervals
	$dbconn=pg_connect("host=".$host." dbname=".$dbname." user=".$user." password=".$password) or die ('Impossible to connect to the database: '.pg_last_error());
	$query="select hash from slides where name='".$_POST['pull']."'";
	$result=pg_query($query) or die('Request failed: '.pg_last_error());
	$val=pg_fetch_array($result,null,PGSQL_ASSOC);
	if ($val) echo $val['hash'];
	pg_free_result($result);
	pg_close($dbconn);
}
?>
